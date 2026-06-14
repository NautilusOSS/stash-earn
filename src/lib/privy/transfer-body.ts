import { formatUnits } from "viem";

/** Build a same-chain Base USDC transfer body for Privy's /transfer API. */
export function buildUsdcTransferBody(
  destinationAddress: `0x${string}`,
  amountAtomic: bigint,
): Record<string, unknown> {
  return {
    amount_type: "exact_input",
    source: {
      asset: "usdc",
      amount: formatUnits(amountAtomic, 6),
      chain: "base",
    },
    destination: {
      address: destinationAddress,
    },
  };
}
