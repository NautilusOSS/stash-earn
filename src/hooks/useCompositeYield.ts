import { useDorkFiSupplyApy } from "@/hooks/useDorkFiSupplyApy";
import { useDorkFiUsdcPosition } from "@/hooks/useDorkFiUsdcPosition";
import { useEarnPosition } from "@/hooks/useEarnPosition";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import { useWalletUsdcBalance } from "@/hooks/useWalletUsdcBalance";
import { resolveCompositeYield } from "@/lib/stash/composite-yield";

export function useCompositeYield(walletAddress: string | undefined) {
  const {
    balance: walletTotal,
    isLoading: walletLoading,
    isFetching: walletFetching,
  } = useWalletUsdcBalance(walletAddress);
  const {
    assetsInVault,
    isLoading: positionLoading,
    isFetching: positionFetching,
  } = useEarnPosition(walletAddress);
  const {
    configured: earnConfigured,
    userApyDecimal,
    isLoading: vaultDetailsLoading,
  } = useEarnVaultDetails();
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
  const apyLoading = vaultDetailsLoading || dorkFiApyLoading;
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

  return {
    totalBalance,
    earningBalance,
    compositeApyDecimal: composite?.decimal ?? null,
    compositeApyLabel: composite?.label ?? null,
    compositeYieldDetail: composite?.detailLabel ?? null,
    apyLoading,
    isLoading,
    isFetching,
  };
}
