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
      "Send wallet USDC to Voi and supply to the DorkFi lending pool.",
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

export function isDorkFiEarnAvailable(input: {
  /** Execution status loaded and spendable VOI meets the DorkFi supply minimum. */
  dorkFiExecutionReady: boolean;
  usdcOptedIn: boolean;
  voiBridgeConfigured: boolean;
  dorkFiUsdcBalance?: number;
  /** When set, DorkFi via bridge requires wallet USDC on Base. */
  walletBaseBalance?: number;
}): boolean {
  if (!input.dorkFiExecutionReady) return false;

  const hasVoiUsdc = (input.dorkFiUsdcBalance ?? 0) > 0;
  if (hasVoiUsdc) {
    return input.usdcOptedIn;
  }

  const canBridgeFromWallet =
    input.voiBridgeConfigured &&
    (input.walletBaseBalance === undefined || input.walletBaseBalance > 0);

  // USDC opt-in is completed as the first step of earn when bridging from Base.
  return canBridgeFromWallet;
}

export function getDorkFiEarnHint(input: {
  available: boolean;
  voiBridgeConfigured: boolean;
  dorkFiUsdcBalance?: number;
  walletBaseBalance?: number;
  supplyApyLabel?: string | null;
  usdcOptedIn?: boolean;
  spendableVoi?: number;
  minSpendableVoi?: number;
}): string {
  const apy = input.supplyApyLabel ? `${input.supplyApyLabel} APY` : "DorkFi yield";
  const hasVoiUsdc = (input.dorkFiUsdcBalance ?? 0) > 0;
  const viaBridge =
    input.voiBridgeConfigured &&
    !hasVoiUsdc &&
    (input.walletBaseBalance === undefined || input.walletBaseBalance > 0);

  if (input.available) {
    if (viaBridge && input.usdcOptedIn === false) {
      return `Opts into USDC, sends to Voi, then supplies to pool · ${apy}`;
    }
    if (viaBridge) {
      return `Sends wallet USDC to Voi, then supplies to pool · ${apy}`;
    }
    if (hasVoiUsdc) {
      return `Supplies USDC on Voi to pool · ${apy}`;
    }
    return `${apy} on Voi`;
  }

  if (
    input.spendableVoi != null &&
    input.minSpendableVoi != null &&
    input.spendableVoi < input.minSpendableVoi
  ) {
    return `Fund execution address with ≥${input.minSpendableVoi} VOI for supply fees`;
  }
  if (!input.voiBridgeConfigured && !hasVoiUsdc) {
    return "Voi bridge not configured on server";
  }
  if (
    input.voiBridgeConfigured &&
    input.walletBaseBalance != null &&
    input.walletBaseBalance <= 0 &&
    !hasVoiUsdc
  ) {
    return "No wallet USDC to send to Voi";
  }
  if (hasVoiUsdc && input.usdcOptedIn === false) {
    return "Opt into USDC on your Voi execution address in Account";
  }
  return "Not ready yet";
}

export function resolveAutoEarnTarget(input: {
  preference: AutoEarnDestination;
  earnVaultApyDecimals: Partial<Record<EarnVaultDestinationId, number | null>>;
  dorkFiApyDecimal: number | null;
  earnConfigured: boolean;
  /** Execution status loaded with enough spendable VOI for DorkFi supply fees. */
  dorkFiExecutionReady: boolean;
  usdcOptedIn: boolean;
  /** Privy Base transfer + platform Voi USDC mirror configured on the server. */
  voiBridgeConfigured: boolean;
  /** USDC already on the Voi execution address. */
  dorkFiUsdcBalance?: number;
  /** Base wallet USDC available to bridge for DorkFi earn. */
  walletBaseBalance?: number;
}): ResolvedAutoEarnTarget | null {
  const dorkFiAvailable = isDorkFiEarnAvailable({
    dorkFiExecutionReady: input.dorkFiExecutionReady,
    usdcOptedIn: input.usdcOptedIn,
    voiBridgeConfigured: input.voiBridgeConfigured,
    dorkFiUsdcBalance: input.dorkFiUsdcBalance,
    walletBaseBalance: input.walletBaseBalance,
  });

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
