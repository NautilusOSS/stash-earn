export type EarnVaultConfig = {
  id: string;
  name: string;
};

/** Gauntlet USDC Prime — previous default Privy Earn vault on Base. */
export const GAUNTLET_USDC_PRIME_VAULT: EarnVaultConfig = {
  id: "n8g9l0xedmyxku37j7r5g7hy",
  name: "Gauntlet USDC Prime",
};

/** Steakhouse Prime USDC — Privy Earn vault on Base. */
export const STEAKHOUSE_PRIME_USDC_VAULT: EarnVaultConfig = {
  id: "e98kp0q62s8rmtcxty76fh15",
  name: "Steakhouse Prime USDC",
};

/** Known Privy Earn vaults. Add entries here when enabling new vaults in the app. */
export const EARN_VAULTS: EarnVaultConfig[] = [
  GAUNTLET_USDC_PRIME_VAULT,
  STEAKHOUSE_PRIME_USDC_VAULT,
];

export const DEFAULT_EARN_VAULT_ID = STEAKHOUSE_PRIME_USDC_VAULT.id;

export function resolveEarnVaultId(configuredId?: string): string {
  const id = configuredId?.trim() || DEFAULT_EARN_VAULT_ID;
  if (!id) {
    throw new Error(
      "Privy Earn is not configured. Set PRIVY_VAULT_ID from Dashboard → Earn.",
    );
  }
  return id;
}

export function getEarnVaultById(vaultId: string): EarnVaultConfig | undefined {
  return EARN_VAULTS.find((vault) => vault.id === vaultId);
}

export function getEarnVaultName(vaultId: string): string {
  return getEarnVaultById(vaultId)?.name ?? "Earn vault";
}

export function isKnownEarnVaultId(vaultId: string): boolean {
  return EARN_VAULTS.some((vault) => vault.id === vaultId);
}
