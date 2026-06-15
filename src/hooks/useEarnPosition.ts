import { usePrivy } from "@privy-io/react-auth";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { getEarnPositionFn } from "@/lib/api/earn.functions";
import type { EarnPosition } from "@/lib/privy/earn.types";
import { EARN_VAULTS } from "@/lib/privy/vaults";
import { validateEvmAddress } from "@/lib/xchain/validate";

export const earnPositionQueryKey = (
  address: string | undefined,
  vaultId: string,
) => ["earn-position", vaultId, address] as const;

export function earnPositionQueryKeysForAddress(address: string | undefined) {
  return EARN_VAULTS.map((vault) => earnPositionQueryKey(address, vault.id));
}

export async function invalidateEarnPositionQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  address: string,
) {
  await Promise.all(
    EARN_VAULTS.map((vault) =>
      queryClient.invalidateQueries({
        queryKey: earnPositionQueryKey(address, vault.id),
      }),
    ),
  );
}

export type EarnVaultPosition = {
  vaultId: string;
  vaultName: string;
  position: EarnPosition | null;
  assetsInVault: number;
  assetsInVaultAtomic: string;
  earnedYield: number;
};

export function useEarnPosition(walletAddress: string | undefined) {
  const { getAccessToken } = usePrivy();
  const validation = walletAddress ? validateEvmAddress(walletAddress) : null;
  const normalizedAddress = validation?.valid ? validation.normalized : undefined;

  const queries = useQueries({
    queries: EARN_VAULTS.map((vault) => ({
      queryKey: earnPositionQueryKey(normalizedAddress, vault.id),
      queryFn: async () => {
        const accessToken = await getAccessToken();
        if (!accessToken) {
          throw new Error("Sign in to view your earn position.");
        }
        return getEarnPositionFn({
          data: {
            accessToken,
            evmAddress: normalizedAddress!,
            vaultId: vault.id,
          },
        });
      },
      enabled: validation?.valid === true,
      staleTime: 30_000,
      refetchInterval: 60_000,
    })),
  });

  const vaultPositions = useMemo<EarnVaultPosition[]>(
    () =>
      EARN_VAULTS.map((vault, index) => {
        const position = queries[index]?.data?.position ?? null;
        return {
          vaultId: vault.id,
          vaultName: vault.name,
          position,
          assetsInVault: position?.assetsInVault ?? 0,
          assetsInVaultAtomic: position?.assetsInVaultAtomic ?? "0",
          earnedYield: position?.earnedYield ?? 0,
        };
      }),
    [queries],
  );

  const positionsByVault = useMemo(
    () =>
      Object.fromEntries(
        vaultPositions.map((entry) => [entry.vaultId, entry.position]),
      ) as Record<string, EarnPosition | null>,
    [vaultPositions],
  );

  const assetsInVaultAtomic = useMemo(() => {
    return vaultPositions
      .reduce((sum, entry) => sum + BigInt(entry.assetsInVaultAtomic || "0"), 0n)
      .toString();
  }, [vaultPositions]);

  const assetsInVault = useMemo(() => {
    return vaultPositions.reduce((sum, entry) => sum + entry.assetsInVault, 0);
  }, [vaultPositions]);

  const earnedYield = useMemo(() => {
    return vaultPositions.reduce((sum, entry) => sum + entry.earnedYield, 0);
  }, [vaultPositions]);

  const configured = queries.some((query) => query.data?.configured === true);
  const isLoading = queries.some((query) => query.isLoading);
  const isFetching = queries.some((query) => query.isFetching);
  const error =
    validation && !validation.valid
      ? validation.error
      : queries.find((query) => query.error)?.error?.message;

  const refetch = async () => {
    await Promise.all(queries.map((query) => query.refetch()));
  };

  return {
    configured,
    vaultPositions,
    positionsByVault,
    position: vaultPositions[0]?.position ?? null,
    assetsInVault,
    assetsInVaultAtomic,
    earnedYield,
    isLoading,
    isFetching,
    error,
    refetch,
  };
}
