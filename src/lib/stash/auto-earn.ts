import {
  DEFAULT_EARN_VAULT_ID,
  EARN_VAULTS,
  getEarnVaultName,
  isKnownEarnVaultId,
} from "@/lib/privy/vaults";

export const EARN_VAULT_DESTINATION_IDS = EARN_VAULTS.map((vault) => vault.id);

export type EarnVaultDestinationId = (typeof EARN_VAULTS)[number]["id"];

export const NON_VAULT_AUTO_EARN_DESTINATIONS = ["dorkfi", "highest_yield"] as const;

export type NonVaultAutoEarnDestination = (typeof NON_VAULT_AUTO_EARN_DESTINATIONS)[number];

export const AUTO_EARN_DESTINATIONS = [
  ...EARN_VAULT_DESTINATION_IDS,
  ...NON_VAULT_AUTO_EARN_DESTINATIONS,
] as const;

export type AutoEarnDestination = EarnVaultDestinationId | NonVaultAutoEarnDestination;

export type ResolvedAutoEarnTarget = EarnVaultDestinationId | "dorkfi";

export const DEFAULT_AUTO_EARN_DESTINATION: AutoEarnDestination = DEFAULT_EARN_VAULT_ID;

export type AutoEarnDestinationOption = {
  id: AutoEarnDestination;
  label: string;
  description: string;
};

export const AUTO_EARN_OPTIONS: AutoEarnDestinationOption[] = [
  ...EARN_VAULTS.map((vault) => ({
    id: vault.id as AutoEarnDestination,
    label: vault.name,
    description: `Sweep Base USDC into ${vault.name} after each deposit.`,
  })),
  {
    id: "dorkfi",
    label: "DorkFi",
    description:
      "Move Base USDC to Voi and supply to DorkFi automatically when your execution address is ready.",
  },
  {
    id: "highest_yield",
    label: "Highest yield",
    description:
      "Automatically choose Gauntlet USDC Prime, Steakhouse Prime USDC, or DorkFi based on the best APY at deposit time.",
  },
];

export function isEarnVaultDestination(
  destination: AutoEarnDestination,
): destination is EarnVaultDestinationId {
  return isKnownEarnVaultId(destination);
}

export function parseAutoEarnDestination(value: unknown): AutoEarnDestination {
  if (value === "earn_vault") {
    return DEFAULT_AUTO_EARN_DESTINATION;
  }
  if (typeof value === "string" && AUTO_EARN_DESTINATIONS.includes(value as AutoEarnDestination)) {
    return value as AutoEarnDestination;
  }
  return DEFAULT_AUTO_EARN_DESTINATION;
}

export function getAutoEarnDestinationLabel(destination: AutoEarnDestination): string {
  if (destination === "dorkfi") return "DorkFi";
  if (destination === "highest_yield") return "Highest yield";
  return getEarnVaultName(destination);
}

function pickHighestYieldVault(
  earnVaultApyDecimals: Partial<Record<EarnVaultDestinationId, number | null>>,
): EarnVaultDestinationId | null {
  let bestVault: EarnVaultDestinationId | null = null;
  let bestApy = -1;

  for (const vault of EARN_VAULTS) {
    const apy = earnVaultApyDecimals[vault.id as EarnVaultDestinationId];
    if (apy != null && apy >= 0 && apy > bestApy) {
      bestApy = apy;
      bestVault = vault.id as EarnVaultDestinationId;
    }
  }

  return bestVault;
}

export function resolveAutoEarnTarget(input: {
  preference: AutoEarnDestination;
  earnVaultApyDecimals: Partial<Record<EarnVaultDestinationId, number | null>>;
  dorkFiApyDecimal: number | null;
  earnConfigured: boolean;
  /** Opted into Voi USDC with enough VOI for a DorkFi deposit. */
  dorkFiExecutionReady: boolean;
  /** Privy Base transfer + platform Voi USDC mirror configured on the server. */
  voiBridgeConfigured: boolean;
  /** USDC already on the Voi execution address. */
  dorkFiUsdcBalance?: number;
}): ResolvedAutoEarnTarget | null {
  const hasVoiUsdc = (input.dorkFiUsdcBalance ?? 0) > 0;
  const dorkFiAvailable =
    input.dorkFiExecutionReady && (hasVoiUsdc || input.voiBridgeConfigured);

  if (isEarnVaultDestination(input.preference)) {
    return input.earnConfigured ? input.preference : null;
  }

  if (input.preference === "dorkfi") {
    return dorkFiAvailable ? "dorkfi" : null;
  }

  const bestVault = pickHighestYieldVault(input.earnVaultApyDecimals);
  const bestEarnApy =
    bestVault != null ? (input.earnVaultApyDecimals[bestVault] ?? -1) : -1;
  const dorkFiApy = input.dorkFiApyDecimal ?? -1;
  const earnAvailable = input.earnConfigured && bestVault != null && bestEarnApy >= 0;

  if (earnAvailable && dorkFiAvailable) {
    return dorkFiApy > bestEarnApy ? "dorkfi" : bestVault;
  }
  if (dorkFiAvailable) return "dorkfi";
  if (earnAvailable) return bestVault;
  return null;
}
