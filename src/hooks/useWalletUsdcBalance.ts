import { useQuery } from "@tanstack/react-query";

import { getXChainExecutionUsdcBalance } from "@/lib/api/xchain.functions";
import { fetchWalletUsdcBalance } from "@/lib/privy/usdcBalance";
import { validateEvmAddress } from "@/lib/xchain/validate";

export type WalletUsdcBalanceBreakdown = {
  total: number;
  baseBalance: number;
  executionBalance: number;
};

export const walletUsdcBalanceQueryKey = (address: string | undefined) =>
  ["wallet-usdc-balance", address] as const;

export function useWalletUsdcBalance(walletAddress: string | undefined) {
  const validation = walletAddress ? validateEvmAddress(walletAddress) : null;

  const query = useQuery({
    queryKey: walletUsdcBalanceQueryKey(
      validation?.valid ? validation.normalized : undefined,
    ),
    queryFn: async (): Promise<WalletUsdcBalanceBreakdown> => {
      const evmAddress = validation!.normalized;
      const [baseBalance, voiResult] = await Promise.all([
        fetchWalletUsdcBalance(evmAddress),
        getXChainExecutionUsdcBalance({ data: { evmAddress } }),
      ]);
      const executionBalance = voiResult.balance;
      return {
        total: baseBalance + executionBalance,
        baseBalance,
        executionBalance,
      };
    },
    enabled: validation?.valid === true,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return {
    balance: query.data?.total ?? 0,
    baseBalance: query.data?.baseBalance ?? 0,
    executionBalance: query.data?.executionBalance ?? 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: validation && !validation.valid ? validation.error : query.error?.message,
    refetch: query.refetch,
  };
}
