import { base } from "viem/chains";

export const CHAIN = base;

export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const USDC_DECIMALS = 6;

export const PRIVY_API_URL = "https://api.privy.io/v1";

export function getPrivyAppId(): string {
  return import.meta.env.VITE_PRIVY_APP_ID ?? "";
}

export function getVaultId(): string {
  return import.meta.env.VITE_PRIVY_VAULT_ID ?? "";
}

export function truncateAddress(address: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
