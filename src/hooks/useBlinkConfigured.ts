import { useQuery } from "@tanstack/react-query";

import { getBlinkConfiguredFn } from "@/lib/api/blink.functions";
import { getBlinkEnvironmentClient, getBlinkMerchantIdClient } from "@/lib/blink/config";

export const blinkConfiguredQueryKey = ["blink-configured"] as const;

export function useBlinkConfigured() {
  const clientMerchantId = getBlinkMerchantIdClient();

  const configuredQuery = useQuery({
    queryKey: blinkConfiguredQueryKey,
    queryFn: async () => getBlinkConfiguredFn(),
    staleTime: 60_000,
  });

  const serverStatus = configuredQuery.data;
  const serverConfigured = serverStatus?.configured === true;
  const configured = Boolean(clientMerchantId) && serverConfigured;

  return {
    configured,
    environment: serverStatus?.environment ?? "production",
    chainId: serverStatus?.chainId ?? 8453,
    chainLabel: serverStatus?.chainLabel ?? "Base",
    hasMerchantId: Boolean(clientMerchantId) && serverStatus?.hasMerchantId === true,
    hasPrivateKey: serverStatus?.hasPrivateKey === true,
    envMismatch:
      Boolean(serverStatus) && getBlinkEnvironmentClient() !== serverStatus?.environment,
    isLoading: configuredQuery.isLoading,
    error: configuredQuery.error?.message,
    refetch: configuredQuery.refetch,
  };
}
