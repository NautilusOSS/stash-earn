import { useQuery } from "@tanstack/react-query";

import { getVoiBridgeConfiguredFn } from "@/lib/api/voi-bridge.functions";

export const voiBridgeConfiguredQueryKey = ["voi-bridge-configured"] as const;

export function useVoiBridgeConfigured() {
  const query = useQuery({
    queryKey: voiBridgeConfiguredQueryKey,
    queryFn: () => getVoiBridgeConfiguredFn(),
    staleTime: 60_000,
  });

  return {
    configured: query.data?.configured === true,
    isLoading: query.isLoading,
    error: query.error?.message,
  };
}
