import { useQuery } from "@tanstack/react-query";

import { getDynamicConfiguredFn } from "@/lib/api/dynamic.functions";
import { getDynamicCheckoutIdClient, getDynamicEnvironmentIdClient } from "@/lib/dynamic/config";

export const dynamicConfiguredQueryKey = ["dynamic-configured"] as const;

export function useDynamicConfigured() {
  const clientEnvironmentId = getDynamicEnvironmentIdClient();
  const clientCheckoutId = getDynamicCheckoutIdClient();

  const configuredQuery = useQuery({
    queryKey: dynamicConfiguredQueryKey,
    queryFn: async () => getDynamicConfiguredFn(),
    staleTime: 60_000,
  });

  const serverStatus = configuredQuery.data;
  const serverConfigured = serverStatus?.configured === true;
  const configured = Boolean(clientEnvironmentId && clientCheckoutId) && serverConfigured;

  return {
    configured,
    environmentId: serverStatus?.environmentId ?? clientEnvironmentId ?? null,
    hasCheckoutId: Boolean(clientCheckoutId) && serverStatus?.hasCheckoutId === true,
    envMismatch:
      Boolean(serverStatus?.environmentId) &&
      clientEnvironmentId !== "" &&
      serverStatus?.environmentId !== clientEnvironmentId,
    isLoading: configuredQuery.isLoading,
    error: configuredQuery.error?.message,
    refetch: configuredQuery.refetch,
  };
}
