import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseAbi,
  type Hash,
  type WalletClient,
} from "viem";
import { base } from "viem/chains";

import type { DynamicSigningPayload } from "@/lib/dynamic/types";
import { chainIdToHex, getDynamicChain } from "@/lib/dynamic/chains";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export async function connectInjectedWallet(): Promise<{
  address: `0x${string}`;
  chainId: number;
}> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("No browser wallet found. Install MetaMask or Coinbase Wallet.");
  }

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  const address = accounts[0] as `0x${string}` | undefined;
  if (!address) {
    throw new Error("Wallet did not return an address.");
  }

  const chainHex = (await provider.request({ method: "eth_chainId" })) as string;
  const chainId = Number.parseInt(chainHex, 16);

  return { address, chainId };
}

export async function switchInjectedChain(chainId: number): Promise<void> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("No browser wallet found.");
  }

  const hex = chainIdToHex(chainId);

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hex }],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.toLowerCase().includes("unrecognized chain")) {
      throw err;
    }
    throw new Error(
      `Add ${getDynamicChain(chainId)?.label ?? "this network"} to your wallet, then try again.`,
    );
  }
}

function walletClientForChain(
  provider: Eip1193Provider,
  chainId: number,
  account: `0x${string}`,
): WalletClient {
  const chain = getDynamicChain(chainId);
  const viemChain =
    chainId === base.id
      ? base
      : {
          id: chainId,
          name: chain?.label ?? `Chain ${chainId}`,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: ["https://cloudflare-eth.com"] } },
        };

  return createWalletClient({
    account,
    chain: viemChain as typeof base,
    transport: custom(provider),
  });
}

export async function signAndBroadcastDynamicEvmPayload(params: {
  signingPayload: DynamicSigningPayload;
  fromAddress: `0x${string}`;
}): Promise<Hash> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error("No browser wallet found.");
  }

  const chainId = Number.parseInt(params.signingPayload.chainId, 10);
  await switchInjectedChain(chainId);

  const walletClient = walletClientForChain(provider, chainId, params.fromAddress);
  const publicClient = createPublicClient({
    chain: walletClient.chain,
    transport: custom(provider),
  });

  const { signingPayload } = params;

  if (signingPayload.evmApproval) {
    const { tokenAddress, spenderAddress, amount } = signingPayload.evmApproval;
    const approvalHash = await walletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: parseAbi(["function approve(address,uint256) returns (bool)"]),
      functionName: "approve",
      args: [spenderAddress as `0x${string}`, BigInt(amount)],
      account: params.fromAddress,
      chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: approvalHash });
  }

  if (!signingPayload.evmTransaction) {
    throw new Error("Missing EVM transaction payload.");
  }

  const txHash = await walletClient.sendTransaction({
    account: params.fromAddress,
    chain: walletClient.chain,
    to: signingPayload.evmTransaction.to as `0x${string}`,
    data: signingPayload.evmTransaction.data as `0x${string}`,
    value: BigInt(signingPayload.evmTransaction.value),
    gas: signingPayload.evmTransaction.gasLimit
      ? BigInt(signingPayload.evmTransaction.gasLimit)
      : undefined,
  });

  return txHash;
}
