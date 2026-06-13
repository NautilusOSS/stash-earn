import { useQuery } from "@tanstack/react-query";

import { VOI_MAINNET_A_MARKET_USDC } from "@/lib/dorkfi/constants";
import { fetchDorkFiMarketData } from "@/lib/dorkfi/marketData";
import { formatSupplyApyPercent, resolveSupplyApy } from "@/lib/dorkfi/supplyApy";

const market = VOI_MAINNET_A_MARKET_USDC;

export function useDorkFiSupplyApy() {
  const query = useQuery({
    queryKey: ["dorkfi-market", market.chain, market.poolId, market.marketId],
    queryFn: () => fetchDorkFiMarketData(market.chain, market.poolId, market.marketId),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const supplyApyPercent =
    query.data != null ? resolveSupplyApy(query.data).supplyApyPercent : null;

  return {
    ...query,
    supplyApyPercent,
    supplyApyDecimal: supplyApyPercent != null ? supplyApyPercent / 100 : null,
    supplyApyLabel:
      query.isLoading
        ? "…"
        : supplyApyPercent != null
          ? formatSupplyApyPercent(supplyApyPercent)
          : null,
  };
}
