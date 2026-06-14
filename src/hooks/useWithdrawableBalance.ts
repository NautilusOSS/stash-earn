import { useEarnPosition } from "@/hooks/useEarnPosition";
import { useWalletUsdcBalance } from "@/hooks/useWalletUsdcBalance";
import { atomicToUsdc, usdcToAtomic } from "@/lib/privy/earn-amount";
import { totalWithdrawableAtomic, walletPlusVaultAtomic } from "@/lib/stash/withdraw-plan";

export function useWithdrawableBalance(walletAddress: string | undefined) {
  const { baseBalance, executionBalance, isLoading: walletLoading } =
    useWalletUsdcBalance(walletAddress);
  const {
    assetsInVault,
    assetsInVaultAtomic,
    isLoading: positionLoading,
  } = useEarnPosition(walletAddress);

  const walletAtomic = BigInt(usdcToAtomic(baseBalance));
  const vaultAtomic = BigInt(assetsInVaultAtomic || "0");
  const voiAtomic = BigInt(usdcToAtomic(executionBalance));
  const buckets = { walletAtomic, vaultAtomic, voiAtomic };
  const totalAtomic = totalWithdrawableAtomic(buckets);
  const executableAtomic = walletPlusVaultAtomic(buckets);

  const total = atomicToUsdc(totalAtomic.toString());
  const executableTotal = atomicToUsdc(executableAtomic.toString());

  return {
    total,
    totalAtomic: totalAtomic.toString(),
    executableTotal,
    executableAtomic: executableAtomic.toString(),
    walletBalance: baseBalance,
    vaultBalance: assetsInVault,
    voiBalance: executionBalance,
    walletAtomic: walletAtomic.toString(),
    vaultAtomic: vaultAtomic.toString(),
    voiAtomic: voiAtomic.toString(),
    isLoading: walletLoading || positionLoading,
    hasBalance: total > 0,
    canWithdrawNow: executableTotal > 0,
  };
}
