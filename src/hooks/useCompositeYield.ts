import { useMemo } from "react";

import { useDorkFiSupplyApy } from "@/hooks/useDorkFiSupplyApy";
import { useDorkFiUsdcPosition } from "@/hooks/useDorkFiUsdcPosition";
import { useEarnPosition } from "@/hooks/useEarnPosition";
import { useEarnVaultApys } from "@/hooks/useEarnVaultApys";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import { useWalletUsdcBalance } from "@/hooks/useWalletUsdcBalance";
import { EARN_VAULTS } from "@/lib/privy/vaults";
import {
  estimateAnnualYield,
  estimateDailyYield,
  resolveCompositeYield,
} from "@/lib/stash/composite-yield";

export function useCompositeYield(walletAddress: string | undefined) {
  const {
    balance: walletTotal,
    isLoading: walletLoading,
    isFetching: walletFetching,
  } = useWalletUsdcBalance(walletAddress);
  const {
    assetsInVault,
    vaultPositions,
    isLoading: positionLoading,
    isFetching: positionFetching,
  } = useEarnPosition(walletAddress);
  const { apyDecimals, isLoading: vaultApyLoading } = useEarnVaultApys();
  const { configured: earnConfigured } = useEarnVaultDetails();
  const {
    balance: dorkFiBalance,
    isLoading: dorkFiLoading,
    isFetching: dorkFiFetching,
  } = useDorkFiUsdcPosition(walletAddress);
  const {
    supplyApyDecimal,
    isLoading: dorkFiApyLoading,
    isFetching: dorkFiApyFetching,
  } = useDorkFiSupplyApy();

  const earnBalance = earnConfigured ? assetsInVault : 0;
  const totalBalance = earnBalance + walletTotal + dorkFiBalance;
  const earningBalance = earnBalance + dorkFiBalance;

  const userApyDecimal = useMemo(() => {
    if (!earnConfigured || earnBalance <= 0) return null;

    let weighted = 0;
    for (const vault of EARN_VAULTS) {
      const entry = vaultPositions.find((position) => position.vaultId === vault.id);
      const balance = entry?.assetsInVault ?? 0;
      const apy = apyDecimals[vault.id as keyof typeof apyDecimals];
      if (balance > 0 && apy != null) {
        weighted += balance * apy;
      }
    }

    return weighted > 0 ? weighted / earnBalance : null;
  }, [earnConfigured, earnBalance, vaultPositions, apyDecimals]);

  const apyLoading = vaultApyLoading || dorkFiApyLoading;
  const isLoading = walletLoading || positionLoading || dorkFiLoading;
  const isFetching =
    walletFetching || positionFetching || dorkFiFetching || dorkFiApyFetching;

  const composite = resolveCompositeYield({
    totalBalance,
    earnBalance,
    earnApyDecimal: userApyDecimal,
    dorkFiBalance,
    dorkFiApyDecimal: supplyApyDecimal,
    apyLoading,
  });

  const compositeApyDecimal = composite?.decimal ?? null;

  return {
    totalBalance,
    earningBalance,
    compositeApyDecimal,
    compositeApyLabel: composite?.label ?? null,
    compositeYieldDetail: composite?.detailLabel ?? null,
    estimatedAnnualYield: estimateAnnualYield(totalBalance, compositeApyDecimal),
    estimatedDailyYield: estimateDailyYield(totalBalance, compositeApyDecimal),
    apyLoading,
    isLoading,
    isFetching,
  };
}
