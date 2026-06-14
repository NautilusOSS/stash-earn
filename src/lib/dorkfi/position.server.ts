import { ABI_METHODS, decodeUserResult, simulateABICall } from "dorkfi-mcp/lib/client.js";
import { formatUnits } from "viem";

import { VOI_MAINNET_A_MARKET_USDC } from "./constants";

const WAD = 10n ** 18n;

export type DorkFiUsdcSupplyPosition = {
  balance: number;
  amountAtomic: string;
};

/** Supplied USDC value in DorkFi aUSDC market for an AVM execution address. */
export async function getDorkFiUsdcSupplyBalance(
  avmAddress: string,
): Promise<DorkFiUsdcSupplyPosition> {
  const market = VOI_MAINNET_A_MARKET_USDC;

  try {
    const result = await simulateABICall(
      market.dorkfiChain,
      market.poolId,
      ABI_METHODS.get_user,
      [avmAddress, market.marketId],
    );
    const user = decodeUserResult(result.returnValue);
    const amountAtomic = (user.scaledDeposits * user.depositIndex) / WAD;

    return {
      balance: Number(formatUnits(amountAtomic, market.decimals)),
      amountAtomic: amountAtomic.toString(),
    };
  } catch {
    return { balance: 0, amountAtomic: "0" };
  }
}
