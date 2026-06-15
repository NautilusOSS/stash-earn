import { useQueries } from "@tanstack/react-query";

import { earnVaultDetailsQueryKey } from "@/hooks/useEarnVaultDetails";
import { getEarnVaultDetailsFn } from "@/lib/api/earn.functions";
import { EARN_VAULTS } from "@/lib/privy/vaults";
import type { EarnVaultDestinationId } from "@/lib/stash/auto-earn";

export function useEarnVaultApys() {
  const queries = useQueries({
    queries: EARN_VAULTS.map((vault) => ({
      queryKey: earnVaultDetailsQueryKey(vault.id),
      queryFn: async () =>
        getEarnVaultDetailsFn({
          data: { vaultId: vault.id },
        }),
      staleTime: 60_000,
    })),
  });

  const apyDecimals = Object.fromEntries(
    EARN_VAULTS.map((vault, index) => {
      const bps = queries[index]?.data?.details?.userApyBps;
      return [vault.id, bps != null ? bps / 10_000 : null];
    }),
  ) as Partial<Record<EarnVaultDestinationId, number | null>>;

  const apyLabels = Object.fromEntries(
    EARN_VAULTS.map((vault, index) => {
      const bps = queries[index]?.data?.details?.userApyBps;
      return [vault.id, bps != null ? `${(bps / 100).toFixed(2)}%` : null];
    }),
  ) as Partial<Record<EarnVaultDestinationId, string | null>>;

  const isLoading = queries.some((query) => query.isLoading);

  return { apyDecimals, apyLabels, isLoading };
}
