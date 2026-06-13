/** Convert a USDC dollar amount to 6-decimal atomic string. */
export function usdcToAtomic(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "0";
  return Math.round(amount * 1e6).toString();
}

/** Convert atomic USDC string to dollar amount. */
export function atomicToUsdc(raw: string, decimals = 6): number {
  try {
    return Number(raw) / 10 ** decimals;
  } catch {
    return 0;
  }
}
