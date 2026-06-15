import algosdk from "algosdk";

import { deriveXChainAddresses } from "@/lib/xchain/derive.server";
import {
  buildXChainTypedDataForTxns,
  signAndSubmitVoiXChainTransactionGroup,
} from "@/lib/xchain/transactions.server";
import type { PrivyAuthorizationContext } from "@/lib/privy/privy-api.server";
import type { PrivyWalletActionAuth } from "@/lib/privy/wallet-action-auth";
import {
  resolveXChainRpcWalletAction,
  signXChainTypedDataWithPrivy,
} from "@/lib/privy/wallet-rpc.server";
import type {
  VoiUsdcOptInStatus,
  XChainAssetOptInPrepareResult,
  XChainAssetOptInSubmitResult,
} from "@/lib/xchain/types";
import { validateEvmAddress } from "@/lib/xchain/validate";
import {
  buildAvmUsdcOptInTransaction,
  isAvmAccountOptedIntoUsdc,
} from "@/lib/voi/avm-usdc-opt-in.server";
import { ensureExecutionVoiFromPlatform } from "@/lib/voi/avm-voi-transfer.server";
import { VOI_NETWORK, VOI_USDC_ASSET_ID } from "@/lib/voi/constants";

export async function getVoiUsdcOptInStatus(evmAddress: string): Promise<VoiUsdcOptInStatus> {
  const validation = validateEvmAddress(evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const addresses = await deriveXChainAddresses(validation.normalized);
  const optedIn = await isAvmAccountOptedIntoUsdc(addresses.voiExecutionAddress);

  return {
    assetId: VOI_USDC_ASSET_ID,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: addresses.voiExecutionAddress,
    optedIn,
  };
}

export async function prepareXChainUsdcOptIn(
  evmAddress: string,
): Promise<XChainAssetOptInPrepareResult> {
  const validation = validateEvmAddress(evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const addresses = await deriveXChainAddresses(validation.normalized);

  await ensureExecutionVoiFromPlatform(addresses.voiExecutionAddress);

  if (await isAvmAccountOptedIntoUsdc(addresses.voiExecutionAddress)) {
    throw new Error("Execution address is already opted into USDC on Voi.");
  }

  const txn = await buildAvmUsdcOptInTransaction(addresses.voiExecutionAddress);

  const unsignedTxnBase64 = Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64");
  const typedData = buildXChainTypedDataForTxns([txn]);

  return {
    unsignedTxnBase64,
    typedData,
    assetId: VOI_USDC_ASSET_ID,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: addresses.voiExecutionAddress,
    network: VOI_NETWORK,
  };
}

export async function submitXChainUsdcOptIn(params: {
  evmAddress: string;
  signature: string;
  unsignedTxnBase64: string;
}): Promise<XChainAssetOptInSubmitResult> {
  const validation = validateEvmAddress(params.evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const addresses = await deriveXChainAddresses(validation.normalized);

  let result: { txId: string; confirmedRound: number };
  try {
    result = await signAndSubmitVoiXChainTransactionGroup({
      evmAddress: validation.normalized,
      unsignedTxnBase64: params.unsignedTxnBase64,
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
    confirmedRound: result.confirmedRound,
    assetId: VOI_USDC_ASSET_ID,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: addresses.voiExecutionAddress,
  };
}

/** Prepare, server-sign, and submit USDC opt-in (no client wallet prompt). */
export async function optInXChainUsdcAuthed(
  accessToken: string,
  evmAddress: string,
): Promise<XChainAssetOptInSubmitResult> {
  const prepared = await prepareXChainUsdcOptIn(evmAddress);
  const authCtx: PrivyAuthorizationContext = {};
  const signature = await signXChainTypedDataWithPrivy({
    accessToken,
    evmAddress,
    typedData: prepared.typedData,
    authCtx,
  });

  return submitXChainUsdcOptIn({
    evmAddress,
    signature,
    unsignedTxnBase64: prepared.unsignedTxnBase64,
  });
}

export type XChainUsdcOptInSignPrepareResult = XChainAssetOptInPrepareResult & {
  rpcPath: string;
  rpcBody: Record<string, unknown>;
};

/** Build opt-in txn plus Privy wallet RPC path/body for client authorization signing. */
export async function prepareXChainUsdcOptInSign(
  accessToken: string,
  evmAddress: string,
): Promise<XChainUsdcOptInSignPrepareResult> {
  const prepared = await prepareXChainUsdcOptIn(evmAddress);
  const rpc = await resolveXChainRpcWalletAction({
    accessToken,
    evmAddress,
    typedData: prepared.typedData,
  });

  return {
    ...prepared,
    rpcPath: rpc.path,
    rpcBody: rpc.body,
  };
}

/** Sign via client-authorized Privy RPC and submit USDC opt-in. */
export async function optInXChainUsdcWithClientAuth(params: {
  accessToken: string;
  evmAddress: string;
  unsignedTxnBase64: string;
  typedData: XChainAssetOptInPrepareResult["typedData"];
  rpcPath: string;
  rpcBody: Record<string, unknown>;
  clientAuth: PrivyWalletActionAuth;
}): Promise<XChainAssetOptInSubmitResult> {
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

  return submitXChainUsdcOptIn({
    evmAddress: validation.normalized,
    signature,
    unsignedTxnBase64: params.unsignedTxnBase64,
  });
}
