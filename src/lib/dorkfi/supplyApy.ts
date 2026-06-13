const WAD = 10n ** 18n;
const BASIS_POINTS = 10_000n;

export interface DorkFiSupplyApyInput {
  reserveFactor: string | bigint;
  borrowRate: string | bigint;
  slope: string | bigint;
  totalScaledDeposits: string | bigint;
  totalScaledBorrows: string | bigint;
  depositIndex: string | bigint;
  borrowIndex: string | bigint;
}

export interface DorkFiSupplyApyResult {
  /** Annual supply rate as a percentage (e.g. 8.29 for 8.29%). */
  supplyApyPercent: number;
  /** Utilization as a WAD-scaled bigint. */
  utilizationWad: bigint;
  /** Borrow APR in basis points. */
  borrowAprBps: bigint;
}

function toBigInt(value: string | bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

/**
 * Derives live supply APY from on-chain-style DorkFi market parameters.
 * Uses bigint arithmetic until the final percentage conversion.
 */
export function resolveSupplyApy(market: DorkFiSupplyApyInput): DorkFiSupplyApyResult {
  const reserveFactor = toBigInt(market.reserveFactor);
  const borrowRate = toBigInt(market.borrowRate);
  const slope = toBigInt(market.slope);
  const totalScaledDeposits = toBigInt(market.totalScaledDeposits);
  const totalScaledBorrows = toBigInt(market.totalScaledBorrows);
  const depositIndex = toBigInt(market.depositIndex);
  const borrowIndex = toBigInt(market.borrowIndex);

  const totalDeposits = (totalScaledDeposits * depositIndex) / WAD;
  const totalBorrows = (totalScaledBorrows * borrowIndex) / WAD;

  if (totalDeposits === 0n) {
    return {
      supplyApyPercent: 0,
      utilizationWad: 0n,
      borrowAprBps: borrowRate,
    };
  }

  const utilizationWad = (totalBorrows * WAD) / totalDeposits;
  const borrowAprBps = borrowRate + (slope * totalBorrows) / totalDeposits;
  const supplyAprBps =
    (borrowAprBps * totalBorrows * (BASIS_POINTS - reserveFactor)) /
    (totalDeposits * BASIS_POINTS);

  const supplyApyPercent = Number(supplyAprBps) / 100;

  return {
    supplyApyPercent,
    utilizationWad,
    borrowAprBps,
  };
}

/** Formats a supply APY percentage to two decimal places (e.g. "8.29%"). */
export function formatSupplyApyPercent(percent: number): string {
  return `${percent.toFixed(2)}%`;
}
