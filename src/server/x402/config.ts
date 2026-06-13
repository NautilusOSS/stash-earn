import process from "node:process";

import type { Address } from "viem";

/**
 * Server-only x402 configuration.
 *
 * SECURITY: Never import this module from client/React code. Private keys and
 * mnemonics are read here only — the browser signs payment authorizations;
 * the server verifies and settles using these credentials.
 */
export interface X402ServerConfig {
  evm: {
    privateKey?: string;
    receiverAddress?: Address;
    rpcUrl?: string;
    chainId: number;
    usdcContractAddress?: Address;
  };
  algorand: {
    mnemonic?: string;
    privateKey?: string;
    nodeUrl?: string;
    indexerUrl?: string;
  };
  x402: {
    facilitatorUrl: string;
    defaultUsdcAmount: string;
    maxTimeoutSeconds: number;
    replayStorePath: string;
  };
}

function parseChainId(raw: string | undefined): number {
  const parsed = Number(raw ?? "8453");
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("EVM_CHAIN_ID must be a positive integer.");
  }
  return parsed;
}

export function getX402Config(): X402ServerConfig {
  return {
    evm: {
      privateKey: process.env.EVM_PRIVATE_KEY,
      receiverAddress: process.env.EVM_RECEIVER_ADDRESS as Address | undefined,
      rpcUrl: process.env.EVM_RPC_URL,
      chainId: parseChainId(process.env.EVM_CHAIN_ID),
      usdcContractAddress: process.env.USDC_CONTRACT_ADDRESS as Address | undefined,
    },
    algorand: {
      mnemonic: process.env.ALGORAND_MNEMONIC,
      privateKey: process.env.ALGORAND_PRIVATE_KEY,
      nodeUrl: process.env.ALGORAND_NODE_URL,
      indexerUrl: process.env.ALGORAND_INDEXER_URL,
    },
    x402: {
      facilitatorUrl: process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
      defaultUsdcAmount: process.env.X402_DEFAULT_USDC_AMOUNT ?? "$0.01",
      maxTimeoutSeconds: 300,
      replayStorePath: process.env.X402_REPLAY_STORE_PATH ?? ".data/x402-replay-store.json",
    },
  };
}

/** CAIP-2 network id derived from EVM_CHAIN_ID (e.g. 8453 → eip155:8453). */
export function networkFromChainId(chainId: number): string {
  return `eip155:${chainId}`;
}

export function requireEvmSettlementConfig(): {
  privateKey: string;
  receiverAddress: Address;
  rpcUrl: string;
  chainId: number;
  usdcContractAddress: Address;
  network: string;
} {
  const config = getX402Config();
  const { evm } = config;

  if (!evm.privateKey) {
    throw new MisconfiguredServerError("EVM_PRIVATE_KEY is not set.");
  }
  if (!evm.receiverAddress) {
    throw new MisconfiguredServerError("EVM_RECEIVER_ADDRESS is not set.");
  }
  if (!evm.rpcUrl) {
    throw new MisconfiguredServerError("EVM_RPC_URL is not set.");
  }
  if (!evm.usdcContractAddress) {
    throw new MisconfiguredServerError("USDC_CONTRACT_ADDRESS is not set.");
  }

  return {
    privateKey: evm.privateKey,
    receiverAddress: evm.receiverAddress,
    rpcUrl: evm.rpcUrl,
    chainId: evm.chainId,
    usdcContractAddress: evm.usdcContractAddress,
    network: networkFromChainId(evm.chainId),
  };
}

export class MisconfiguredServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MisconfiguredServerError";
  }
}
