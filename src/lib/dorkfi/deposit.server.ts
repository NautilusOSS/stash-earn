import algosdk from "algosdk";
import { getMarketOnChain } from "dorkfi-mcp/lib/markets.js";
import { formatUnits } from "viem";

import { deriveXChainAddresses } from "@/lib/xchain/derive.server";
import {
  resolveXChainRpcWalletAction,
  signXChainTypedDataWithPrivy,
} from "@/lib/privy/wallet-rpc.server";
import type { PrivyAuthorizationContext } from "@/lib/privy/privy-api.server";
import type { PrivyWalletActionAuth } from "@/lib/privy/wallet-action-auth";
import {
  buildXChainTypedDataForTxns,
  decodeUnsignedTransactionGroup,
  signAndSubmitVoiXChainTransactionGroup,
} from "@/lib/xchain/transactions.server";
import { validateEvmAddress } from "@/lib/xchain/validate";
import {
  MIN_SPENDABLE_VOI_FOR_DORKFI_DEPOSIT,
  VOI_MAINNET_A_MARKET_USDC,
} from "@/lib/dorkfi/constants";
import { buildVoiUsdcLendingDepositTxns } from "@/lib/dorkfi/lending-deposit.server";
import { getExecutionAddressBalances } from "@/lib/voi/execution-account.server";
import { getAvmUsdcHolding } from "@/lib/voi/avm-usdc-balance.server";
import { ensureExecutionVoiFromPlatform } from "@/lib/voi/avm-voi-transfer.server";
import { VOI_BLOCK_EXPLORER_TX, VOI_NETWORK, VOI_USDC_DECIMALS } from "@/lib/voi/constants";

const market = VOI_MAINNET_A_MARKET_USDC;

export type DorkFiUsdcDepositPrepareResult = {
  evmAddress: `0x${string}`;
  voiAddress: string;
  voiExecutionAddress: string;
  network: typeof VOI_NETWORK;
  amount: string;
  amountAtomic: string;
  poolId: number;
  marketId: number;
  underlyingAssetId: number;
  nTokenId: number;
  unsignedTxnsBase64: string[];
  typedData: ReturnType<typeof buildXChainTypedDataForTxns>;
  transactionCount: number;
  spendableBalanceVoi: number;
  usdcBalance: number;
};

export type DorkFiUsdcDepositSubmitResult = {
  txId: string;
  poolApplTxId: string;
  confirmedRound: number;
  voiAddress: string;
  voiExecutionAddress: string;
  explorerUrl: string;
};

function parseDepositAmountAtomic(amountAtomic: string): bigint {
  try {
    const value = BigInt(amountAtomic);
    if (value <= 0n) {
      throw new Error("Deposit amount must be positive");
    }
    return value;
  } catch {
    throw new Error("Invalid USDC deposit amount");
  }
}

function getApplicationIndex(txn: algosdk.Transaction): number | undefined {
  if (txn.appIndex != null) {
    return Number(txn.appIndex);
  }
  const applicationCall = txn.applicationCall;
  if (applicationCall?.appIndex != null) {
    return Number(applicationCall.appIndex);
  }
  return undefined;
}

function findPoolApplicationTxId(txns: algosdk.Transaction[], poolId: number): string {
  const lendingDepositTxn = txns.find((txn) => {
    if (txn.type !== "appl") return false;
    const note = txn.note ? new TextDecoder().decode(txn.note) : "";
    return note.includes("lending deposit");
  });
  if (lendingDepositTxn) {
    return lendingDepositTxn.txID();
  }

  const poolApplTxn = txns.find((txn) => {
    return txn.type === "appl" && getApplicationIndex(txn) === poolId;
  });
  if (!poolApplTxn) {
    throw new Error(`No application call targeting pool ${poolId} in deposit group`);
  }
  return poolApplTxn.txID();
}

export async function prepareDorkFiUsdcDeposit(
  evmAddress: string,
  amountAtomic?: string,
): Promise<DorkFiUsdcDepositPrepareResult> {
  const validation = validateEvmAddress(evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const addresses = await deriveXChainAddresses(validation.normalized);
  const executionAddress = addresses.voiExecutionAddress;

  await ensureExecutionVoiFromPlatform(executionAddress);

  const balances = await getExecutionAddressBalances({
    executionAddress,
    usdcAssetId: market.underlyingAssetId,
    nTokenAssetId: market.nTokenId,
  });

  if (!balances.usdcOptedIn) {
    throw new Error(
      `Execution address is not opted into USDC (ASA ${market.underlyingAssetId}). Opt in first.`,
    );
  }

  const usdcHolding = await getAvmUsdcHolding(executionAddress);
  if (!usdcHolding || usdcHolding.balance <= 0) {
    throw new Error("No USDC on execution address to deposit");
  }

  const depositAtomic = amountAtomic
    ? parseDepositAmountAtomic(amountAtomic)
    : BigInt(usdcHolding.amountAtomic);

  if (BigInt(usdcHolding.amountAtomic) < depositAtomic) {
    throw new Error(
      `Insufficient USDC on execution address: need ${depositAtomic.toString()} micro units, have ${usdcHolding.amountAtomic}`,
    );
  }

  if (balances.spendableVoi < MIN_SPENDABLE_VOI_FOR_DORKFI_DEPOSIT) {
    throw new Error(
      `Insufficient VOI for fees on execution address: need ≥${MIN_SPENDABLE_VOI_FOR_DORKFI_DEPOSIT} spendable VOI, have ${balances.spendableVoi.toFixed(6)}`,
    );
  }

  const onChainMarket = await getMarketOnChain(market.dorkfiChain, market.symbol);
  if (onChainMarket?.paused) {
    throw new Error("DorkFi USDC market is paused");
  }

  const supply = await buildVoiUsdcLendingDepositTxns({
    sender: executionAddress,
    amountAtomic: depositAtomic,
  });

  const unsignedTxnsBase64 = supply.transactions;
  const txns = decodeUnsignedTransactionGroup(unsignedTxnsBase64);
  const typedData = buildXChainTypedDataForTxns(txns);
  const amountLabel = formatUnits(depositAtomic, VOI_USDC_DECIMALS);

  return {
    evmAddress: validation.normalized,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: executionAddress,
    network: VOI_NETWORK,
    amount: amountLabel,
    amountAtomic: depositAtomic.toString(),
    poolId: market.poolId,
    marketId: market.marketId,
    underlyingAssetId: market.underlyingAssetId,
    nTokenId: market.nTokenId,
    unsignedTxnsBase64,
    typedData,
    transactionCount: unsignedTxnsBase64.length,
    spendableBalanceVoi: balances.spendableVoi,
    usdcBalance: balances.usdcBalance,
  };
}

export async function submitDorkFiUsdcDeposit(params: {
  evmAddress: string;
  signature: string;
  unsignedTxnsBase64: string[];
}): Promise<DorkFiUsdcDepositSubmitResult> {
  const validation = validateEvmAddress(params.evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  if (params.unsignedTxnsBase64.length === 0) {
    throw new Error("No unsigned transactions to submit");
  }

  const addresses = await deriveXChainAddresses(validation.normalized);
  const txns = decodeUnsignedTransactionGroup(params.unsignedTxnsBase64);
  const poolApplTxId = findPoolApplicationTxId(txns, market.poolId);

  let result: { txId: string; confirmedRound: number };
  try {
    result = await signAndSubmitVoiXChainTransactionGroup({
      evmAddress: validation.normalized,
      unsignedTxnBase64: params.unsignedTxnsBase64,
      signature: params.signature,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown signing error";
    if (/signature|recover|mismatch|invalid/i.test(message)) {
      throw new Error(
        `EVM signature mismatch — sign with the same wallet that derived this xChain address (${validation.normalized}). ${message}`,
      );
    }
    throw error instanceof Error ? error : new Error(message);
  }

  return {
    txId: result.txId,
    poolApplTxId,
    confirmedRound: result.confirmedRound,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: addresses.voiExecutionAddress,
    explorerUrl: `${VOI_BLOCK_EXPLORER_TX}/${poolApplTxId}`,
  };
}

/** Prepare, server-sign, and submit a DorkFi USDC supply (no client wallet prompt). */
export async function depositDorkFiUsdcAuthed(
  accessToken: string,
  evmAddress: string,
  amountAtomic?: string,
): Promise<DorkFiUsdcDepositSubmitResult> {
  const prepared = await prepareDorkFiUsdcDeposit(evmAddress, amountAtomic);
  const authCtx: PrivyAuthorizationContext = {};
  const signature = await signXChainTypedDataWithPrivy({
    accessToken,
    evmAddress: prepared.evmAddress,
    typedData: prepared.typedData,
    authCtx,
  });

  return submitDorkFiUsdcDeposit({
    evmAddress: prepared.evmAddress,
    signature,
    unsignedTxnsBase64: prepared.unsignedTxnsBase64,
  });
}

export type DorkFiUsdcDepositSignPrepareResult = DorkFiUsdcDepositPrepareResult & {
  rpcPath: string;
  rpcBody: Record<string, unknown>;
};

/** Build deposit txns plus Privy wallet RPC path/body for client authorization signing. */
export async function prepareDorkFiUsdcDepositSign(
  accessToken: string,
  evmAddress: string,
  amountAtomic?: string,
): Promise<DorkFiUsdcDepositSignPrepareResult> {
  const prepared = await prepareDorkFiUsdcDeposit(evmAddress, amountAtomic);
  const rpc = await resolveXChainRpcWalletAction({
    accessToken,
    evmAddress: prepared.evmAddress,
    typedData: prepared.typedData,
  });

  return {
    ...prepared,
    rpcPath: rpc.path,
    rpcBody: rpc.body,
  };
}

/** Sign via client-authorized Privy RPC and submit DorkFi USDC supply. */
export async function depositDorkFiUsdcWithClientAuth(params: {
  accessToken: string;
  evmAddress: string;
  unsignedTxnsBase64: string[];
  typedData: DorkFiUsdcDepositPrepareResult["typedData"];
  rpcPath: string;
  rpcBody: Record<string, unknown>;
  clientAuth: PrivyWalletActionAuth;
}): Promise<DorkFiUsdcDepositSubmitResult> {
  const validation = validateEvmAddress(params.evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const signature = await signXChainTypedDataWithPrivy({
    accessToken: params.accessToken,
    evmAddress: validation.normalized,
    typedData: params.typedData,
    clientAuth: params.clientAuth,
    rpcPath: params.rpcPath,
    rpcBody: params.rpcBody,
  });

  return submitDorkFiUsdcDeposit({
    evmAddress: validation.normalized,
    signature,
    unsignedTxnsBase64: params.unsignedTxnsBase64,
  });
}

export async function getXChainExecutionStatus(evmAddress: string) {
  const validation = validateEvmAddress(evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const addresses = await deriveXChainAddresses(validation.normalized);
  const executionAddress = addresses.voiExecutionAddress;
  await ensureExecutionVoiFromPlatform(executionAddress);
  const balances = await getExecutionAddressBalances({
    executionAddress,
    usdcAssetId: market.underlyingAssetId,
    nTokenAssetId: market.nTokenId,
  });
  const usdcHolding = await getAvmUsdcHolding(executionAddress);

  return {
    evmAddress: validation.normalized,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: addresses.voiExecutionAddress,
    protocol: addresses.protocol,
    usdcAssetId: market.underlyingAssetId,
    nTokenId: market.nTokenId,
    usdcOptedIn: balances.usdcOptedIn,
    nTokenOptedIn: balances.nTokenOptedIn,
    usdcBalance: balances.usdcBalance,
    spendableVoi: balances.spendableVoi,
    minSpendableVoiForDeposit: MIN_SPENDABLE_VOI_FOR_DORKFI_DEPOSIT,
    depositAmount: balances.usdcBalance,
    depositAmountLabel: usdcHolding?.amount ?? "0",
    depositAmountAtomic: usdcHolding?.amountAtomic ?? "0",
  };
}
