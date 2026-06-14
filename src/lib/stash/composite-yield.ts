export type CompositeYieldInput = {
  totalBalance: number;
  earnBalance: number;
  earnApyDecimal: number | null;
  dorkFiBalance: number;
  dorkFiApyDecimal: number | null;
  apyLoading?: boolean;
};

export type CompositeYieldResult = {
  decimal: number;
  label: string;
  detailLabel: string;
};

/** USDC-weighted blend of Earn vault and DorkFi APY; idle wallet balances count at 0%. */
export function resolveCompositeYield(
  input: CompositeYieldInput,
): CompositeYieldResult | null {
  if (input.apyLoading || input.totalBalance <= 0) return null;

  const needsEarnApy = input.earnBalance > 0 && input.earnApyDecimal == null;
  const needsDorkFiApy = input.dorkFiBalance > 0 && input.dorkFiApyDecimal == null;
  if (needsEarnApy || needsDorkFiApy) return null;

  const decimal =
    (input.earnBalance * (input.earnApyDecimal ?? 0) +
      input.dorkFiBalance * (input.dorkFiApyDecimal ?? 0)) /
    input.totalBalance;

  const label = `${(decimal * 100).toFixed(2)}%`;
  return {
    decimal,
    label,
    detailLabel: `${label} composite yield`,
  };
}
