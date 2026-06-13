import { USDC_ADDRESS } from "@/lib/privy/constants";

export type BlinkEnvironment = "production" | "sandbox";

/** Circle USDC on Base Sepolia — https://developers.circle.com/stablecoins/usdc-contract-addresses */
export const BASE_SEPOLIA_USDC = "0x036cbd53842c5426634e7929541ec2318f3dcf7e" as const;

/** Blink / Relay token catalogs use lowercase contract addresses for lookup. */
export const BLINK_MAINNET_USDC = USDC_ADDRESS.toLowerCase() as `0x${string}`;

export const BLINK_CHAIN_CONFIG = {
  production: {
    chainId: 8453,
    usdc: BLINK_MAINNET_USDC,
    payUrl: "https://pay.blink.cash",
    label: "Base",
  },
  sandbox: {
    chainId: 84532,
    usdc: BASE_SEPOLIA_USDC,
    payUrl: "https://pay-sandbox.blink.cash",
    label: "Base Sepolia",
  },
} as const;

export function getBlinkDepositTarget(environment: BlinkEnvironment) {
  const chain = getBlinkChainConfig(environment);
  return { chainId: chain.chainId, token: chain.usdc };
}

export function parseBlinkEnvironment(value: string | undefined): BlinkEnvironment {
  return value?.trim().toLowerCase() === "sandbox" ? "sandbox" : "production";
}

export function getBlinkEnvironmentClient(): BlinkEnvironment {
  return parseBlinkEnvironment(import.meta.env.VITE_BLINK_ENVIRONMENT);
}

export function getBlinkMerchantIdClient(): string {
  return import.meta.env.VITE_BLINK_MERCHANT_ID?.trim() ?? "";
}

export function getBlinkChainConfig(environment: BlinkEnvironment) {
  return BLINK_CHAIN_CONFIG[environment];
}
