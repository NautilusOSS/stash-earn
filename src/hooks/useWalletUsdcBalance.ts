import { useQuery } from "@tanstack/react-query";

import { fetchWalletUsdcBalance } from "@/lib/privy/usdcBalance";
import { validateEvmAddress } from "@/lib/xchain/validate";

export const walletUsdcBalanceQueryKey = (address: string | undefined) =>
  ["wallet-usdc-balance", address] as const;

export function useWalletUsdcBalance(walletAddress: string | undefined) {
  const validation = walletAddress ? validateEvmAddress(walletAddress) : null;

  const query = useQuery({
    queryKey: walletUsdcBalanceQueryKey(
      validation?.valid ? validation.normalized : undefined,
    ),
    queryFn: () => fetchWalletUsdcBalance(validation!.normalized),
    enabled: validation?.valid === true,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    balance: query.data ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: validation && !validation.valid ? validation.error : query.error?.message,
    refetch: query.refetch,
  };
}
