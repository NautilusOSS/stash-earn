import { useQuery } from "@tanstack/react-query";

import { getX402SmokeDiagnosticsFn } from "@/lib/api/x402.functions";
import { validateEvmAddress } from "@/lib/xchain/validate";

export const x402FacilitatorStatusQueryKey = (address: string | undefined) =>
  ["x402-smoke-diagnostics", address] as const;

const MIN_RECOMMENDED_ETH = 0.000_05;

export function useX402FacilitatorStatus(walletAddress: string | undefined) {
  const validation = walletAddress ? validateEvmAddress(walletAddress) : null;

  const query = useQuery({
    queryKey: x402FacilitatorStatusQueryKey(
      validation?.valid ? validation.normalized : undefined,
    ),
    queryFn: async () =>
      getX402SmokeDiagnosticsFn({
        data: { evmAddress: validation!.normalized },
      }),
    enabled: validation?.valid === true,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const status = query.data;
  const ethBalance = status?.ethBalance ?? 0;
  const payerUsdcBalance = status?.payerUsdcBalance ?? 0;
  const requiredUsdc = status?.requiredUsdcAmount ?? "$0.01";
  const requiredAtomic = BigInt(status?.requiredUsdcAtomic ?? "10000");
  const payerAtomic = BigInt(status?.payerUsdcBalanceAtomic ?? "0");
  const hasGas = ethBalance >= MIN_RECOMMENDED_ETH;
  const serverUsdcReady =
    status?.configured === true && !status.rpcError
      ? payerAtomic >= requiredAtomic
      : null;

  return {
    status,
    isConfigured: status?.configured === true,
    facilitatorAddress: status?.facilitatorAddress,
    receiverAddress: status?.receiverAddress,
    chainId: status?.chainId,
    network: status?.network,
    ethBalance,
    hasGas,
    payerUsdcBalance,
    serverUsdcReady,
    requiredUsdc,
    rpcHost: status?.rpcHost,
    rpcError: status?.rpcError,
    usdcName: status?.usdcName,
    usdcVersion: status?.usdcVersion,
    payerWalletKind: status?.payerWalletKind ?? "eoa",
    payerEip3009Compatible: status?.payerEip3009Compatible ?? true,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: validation && !validation.valid ? validation.error : query.error?.message,
    refetch: query.refetch,
  };
};
