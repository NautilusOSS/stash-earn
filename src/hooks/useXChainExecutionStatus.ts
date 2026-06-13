import { useQuery } from "@tanstack/react-query";

import { getXChainExecutionStatusFn } from "@/lib/api/dorkfi.functions";
import { validateEvmAddress } from "@/lib/xchain/validate";

export function useXChainExecutionStatus(evmAddress: string | undefined) {
  const validation = evmAddress ? validateEvmAddress(evmAddress) : null;

  const query = useQuery({
    queryKey: [
      "xchain-execution-status",
      validation?.valid ? validation.normalized : null,
    ],
    queryFn: () => {
      if (!validation?.valid) {
        throw new Error(validation?.error ?? "Invalid EVM address");
      }
      return getXChainExecutionStatusFn({ data: { evmAddress: validation.normalized } });
    },
    enabled: validation?.valid === true,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return {
    status: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: validation && !validation.valid ? validation.error : query.error?.message,
    refetch: query.refetch,
  };
}
