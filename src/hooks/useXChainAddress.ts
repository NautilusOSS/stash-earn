import { useQuery } from "@tanstack/react-query";

import { getXChainAddress } from "@/lib/api/xchain.functions";
import { validateEvmAddress } from "@/lib/xchain/validate";

export function useXChainAddress(evmAddress: string | undefined) {
  const validation = evmAddress ? validateEvmAddress(evmAddress) : null;

  const query = useQuery({
    queryKey: ["xchain-address", validation?.valid ? validation.normalized : null],
    queryFn: () => {
      if (!validation?.valid) {
        throw new Error(validation?.error ?? "Invalid EVM address");
      }
      return getXChainAddress({ data: { evmAddress: validation.normalized } });
    },
    enabled: validation?.valid === true,
    staleTime: Infinity,
  });

  return {
    voiAddress: query.data?.voiAddress,
    voiExecutionAddress: query.data?.voiExecutionAddress,
    addresses: query.data,
    isLoading: query.isLoading,
    error: validation && !validation.valid ? validation.error : query.error?.message,
  };
}
