import { useQuery } from "@tanstack/react-query";

import { getEarnConfiguredFn, getEarnVaultDetailsFn } from "@/lib/api/earn.functions";
import { getVaultId } from "@/lib/privy/constants";

export const earnVaultDetailsQueryKey = (vaultId: string) =>
  ["earn-vault-details", vaultId] as const;

export function useEarnVaultDetails() {
  const clientVaultId = getVaultId();

  const configuredQuery = useQuery({
    queryKey: ["earn-configured"],
    queryFn: async () => getEarnConfiguredFn(),
    staleTime: 60_000,
  });

  const serverConfigured = configuredQuery.data?.configured === true;
  const configured = Boolean(clientVaultId) || serverConfigured;

  const detailsQuery = useQuery({
    queryKey: earnVaultDetailsQueryKey(clientVaultId),
    queryFn: async () =>
      getEarnVaultDetailsFn({
        data: { vaultId: clientVaultId },
      }),
    enabled: configured,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const details = detailsQuery.data?.details;
  const userApyDecimal =
    details?.userApyBps != null ? details.userApyBps / 10000 : null;
  const userApyLabel =
    userApyDecimal != null ? `${(userApyDecimal * 100).toFixed(2)}%` : null;

  const isLoading =
    configuredQuery.isLoading || (configured && detailsQuery.isLoading && !detailsQuery.data);

  return {
    configured,
    details,
    detailsError: detailsQuery.data?.detailsError ?? detailsQuery.error?.message,
    userApyDecimal,
    userApyLabel,
    isLoading,
    error: configuredQuery.error?.message ?? detailsQuery.error?.message,
    refetch: detailsQuery.refetch,
  };
}
