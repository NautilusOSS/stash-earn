export const AUTO_EARN_DESTINATIONS = ["earn_vault", "dorkfi", "highest_yield"] as const;

export type AutoEarnDestination = (typeof AUTO_EARN_DESTINATIONS)[number];

export type ResolvedAutoEarnTarget = "earn_vault" | "dorkfi";

export const DEFAULT_AUTO_EARN_DESTINATION: AutoEarnDestination = "earn_vault";

export type AutoEarnDestinationOption = {
  id: AutoEarnDestination;
  label: string;
  description: string;
};

export const AUTO_EARN_OPTIONS: AutoEarnDestinationOption[] = [
  {
    id: "earn_vault",
    label: "Earn vault",
    description: "Sweep Base USDC into your Privy Earn vault after each deposit.",
  },
  {
    id: "dorkfi",
    label: "DorkFi",
    description:
      "Move Base USDC to Voi and supply to DorkFi automatically when your execution address is ready.",
  },
  {
    id: "highest_yield",
    label: "Highest yield",
    description: "Automatically choose Earn vault or DorkFi based on the better APY at deposit time.",
  },
];

export function parseAutoEarnDestination(value: unknown): AutoEarnDestination {
  if (typeof value === "string" && AUTO_EARN_DESTINATIONS.includes(value as AutoEarnDestination)) {
    return value as AutoEarnDestination;
  }
  return DEFAULT_AUTO_EARN_DESTINATION;
}

export function getAutoEarnDestinationLabel(destination: AutoEarnDestination): string {
  return AUTO_EARN_OPTIONS.find((option) => option.id === destination)?.label ?? "Earn vault";
}

export function resolveAutoEarnTarget(input: {
  preference: AutoEarnDestination;
  earnApyDecimal: number | null;
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

  if (input.preference === "earn_vault") {
    return input.earnConfigured ? "earn_vault" : null;
  }

  if (input.preference === "dorkfi") {
    return dorkFiAvailable ? "dorkfi" : null;
  }

  const earnApy = input.earnApyDecimal ?? -1;
  const dorkFiApy = input.dorkFiApyDecimal ?? -1;
  const earnAvailable = input.earnConfigured && earnApy >= 0;

  if (earnAvailable && dorkFiAvailable) {
    return dorkFiApy > earnApy ? "dorkfi" : "earn_vault";
  }
  if (dorkFiAvailable) return "dorkfi";
  if (earnAvailable) return "earn_vault";
  return null;
}
