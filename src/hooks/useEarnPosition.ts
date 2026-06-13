import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";

import { getEarnPositionFn } from "@/lib/api/earn.functions";
import { validateEvmAddress } from "@/lib/xchain/validate";

export const earnPositionQueryKey = (address: string | undefined) =>
  ["earn-position", address] as const;

export function useEarnPosition(walletAddress: string | undefined) {
  const { getAccessToken } = usePrivy();
  const validation = walletAddress ? validateEvmAddress(walletAddress) : null;

  const query = useQuery({
    queryKey: earnPositionQueryKey(
      validation?.valid ? validation.normalized : undefined,
    ),
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in to view your earn position.");
      }
      return getEarnPositionFn({
        data: {
          accessToken,
          evmAddress: validation!.normalized,
        },
      });
    },
    enabled: validation?.valid === true,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const position = query.data?.position;

  return {
    configured: query.data?.configured ?? false,
    position,
    assetsInVault: position?.assetsInVault ?? 0,
    earnedYield: position?.earnedYield ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: validation && !validation.valid ? validation.error : query.error?.message,
    refetch: query.refetch,
  };
}
