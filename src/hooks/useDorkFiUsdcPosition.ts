import { useQuery } from "@tanstack/react-query";

import { getDorkFiUsdcSupplyBalanceFn } from "@/lib/api/dorkfi.functions";
import { validateEvmAddress } from "@/lib/xchain/validate";

export const dorkFiUsdcPositionQueryKey = (address: string | undefined) =>
  ["dorkfi-usdc-position", address] as const;

export function useDorkFiUsdcPosition(walletAddress: string | undefined) {
  const validation = walletAddress ? validateEvmAddress(walletAddress) : null;

  const query = useQuery({
    queryKey: dorkFiUsdcPositionQueryKey(
      validation?.valid ? validation.normalized : undefined,
    ),
    queryFn: () =>
      getDorkFiUsdcSupplyBalanceFn({
        data: { evmAddress: validation!.normalized },
      }),
    enabled: validation?.valid === true,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    balance: query.data?.balance ?? 0,
    amountAtomic: query.data?.amountAtomic ?? "0",
    voiExecutionAddress: query.data?.voiExecutionAddress,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: validation && !validation.valid ? validation.error : query.error?.message,
    refetch: query.refetch,
  };
}
