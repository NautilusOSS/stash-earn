import { createPublicClient, erc20Abi, formatEther, formatUnits, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

import { describePayerWalletKind, type PayerWalletKind } from "@/lib/x402/wallet-kind";

import { getX402Config, networkFromChainId } from "./config";
import { isEvmSettlementConfigured } from "./settle-evm";

const USDC_DECIMALS = 6;

const usdcMetadataAbi = [
  ...erc20Abi,
  {
    type: "function",
    name: "version",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

export type X402FacilitatorDebugStatus = {
  configured: true;
  facilitatorAddress: `0x${string}`;
  receiverAddress: `0x${string}`;
  chainId: number;
  network: string;
  ethBalance: number;
};

export type X402SmokeDiagnostics = X402FacilitatorDebugStatus & {
  payerAddress: `0x${string}`;
  payerUsdcBalance: number;
  payerUsdcBalanceAtomic: string;
  requiredUsdcAmount: string;
  requiredUsdcAtomic: string;
  usdcContractAddress: `0x${string}`;
  usdcName: string | null;
  usdcVersion: string | null;
  rpcHost: string;
  rpcError: string | null;
  payerWalletKind: PayerWalletKind;
  payerEip3009Compatible: boolean;
};

function chainForId(chainId: number, rpcUrl: string) {
  if (chainId === base.id) return base;
  if (chainId === baseSepolia.id) return baseSepolia;
  return {
    ...base,
    id: chainId,
    rpcUrls: { default: { http: [rpcUrl] } },
  };
}

/** x402 relayer address and ETH balance from EVM_PRIVATE_KEY + EVM_RPC_URL. */
export async function getX402FacilitatorDebugStatus(): Promise<X402FacilitatorDebugStatus | null> {
  if (!isEvmSettlementConfigured()) return null;

  const { evm } = getX402Config();
  if (!evm.privateKey || !evm.rpcUrl || !evm.receiverAddress) return null;

  const account = privateKeyToAccount(evm.privateKey as `0x${string}`);
  const client = createPublicClient({
    chain: chainForId(evm.chainId, evm.rpcUrl),
    transport: http(evm.rpcUrl),
  });

  const balanceWei = await client.getBalance({ address: account.address });

  return {
    configured: true,
    facilitatorAddress: account.address,
    receiverAddress: evm.receiverAddress,
    chainId: evm.chainId,
    network: networkFromChainId(evm.chainId),
    ethBalance: Number(formatEther(balanceWei)),
  };
}

function parseDollarAmount(amount: string): number {
  const trimmed = amount.trim();
  if (trimmed.startsWith("$")) {
    const n = Number(trimmed.slice(1));
    if (!Number.isFinite(n) || n <= 0) throw new Error("Amount must be a positive dollar value.");
    return n;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Amount must be a positive number.");
  return n;
}

function rpcHost(rpcUrl: string): string {
  try {
    return new URL(rpcUrl).hostname;
  } catch {
    return "invalid";
  }
}

/** Facilitator + payer USDC as seen by EVM_RPC_URL (same RPC used for x402 verify). */
export async function getX402SmokeDiagnostics(
  payerAddress: `0x${string}`,
): Promise<X402SmokeDiagnostics | null> {
  const facilitator = await getX402FacilitatorDebugStatus();
  if (!facilitator) return null;

  const { evm, x402 } = getX402Config();
  if (!evm.rpcUrl || !evm.usdcContractAddress) return null;

  const client = createPublicClient({
    chain: chainForId(evm.chainId, evm.rpcUrl),
    transport: http(evm.rpcUrl),
  });

  const requiredUsdcAmount = x402.defaultUsdcAmount;
  const requiredUsdcAtomic = BigInt(Math.round(parseDollarAmount(requiredUsdcAmount) * 10 ** USDC_DECIMALS));

  let payerUsdcBalanceAtomic = 0n;
  let usdcName: string | null = null;
  let usdcVersion: string | null = null;
  let rpcError: string | null = null;
  let payerWalletKind: PayerWalletKind = "eoa";

  try {
    const [balanceAtomic, name, version, payerCode] = await Promise.all([
      client.readContract({
        address: evm.usdcContractAddress,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [payerAddress],
      }),
      client.readContract({
        address: evm.usdcContractAddress,
        abi: usdcMetadataAbi,
        functionName: "name",
      }),
      client.readContract({
        address: evm.usdcContractAddress,
        abi: usdcMetadataAbi,
        functionName: "version",
      }),
      client.getCode({ address: payerAddress }),
    ]);
    payerUsdcBalanceAtomic = balanceAtomic;
    usdcName = name;
    usdcVersion = version;
    payerWalletKind = describePayerWalletKind(payerCode);
  } catch (error) {
    rpcError = error instanceof Error ? error.message : "RPC read failed";
  }

  return {
    ...facilitator,
    payerAddress,
    payerUsdcBalance: Number(formatUnits(payerUsdcBalanceAtomic, USDC_DECIMALS)),
    payerUsdcBalanceAtomic: payerUsdcBalanceAtomic.toString(),
    requiredUsdcAmount,
    requiredUsdcAtomic: requiredUsdcAtomic.toString(),
    usdcContractAddress: evm.usdcContractAddress,
    usdcName,
    usdcVersion,
    rpcHost: rpcHost(evm.rpcUrl),
    rpcError,
    payerWalletKind,
    payerEip3009Compatible:
      payerWalletKind === "eoa" || payerWalletKind === "eip7702",
  };
}
