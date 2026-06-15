import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { toast } from "sonner";

import { useBridgeUsdcToVoi } from "@/hooks/useBridgeUsdcToVoi";
import { useDorkFiSupplyApy } from "@/hooks/useDorkFiSupplyApy";
import { dorkFiUsdcPositionQueryKey } from "@/hooks/useDorkFiUsdcPosition";
import { useDorkfiUsdcDeposit } from "@/hooks/useDorkfiUsdcDeposit";
import { invalidateEarnPositionQueries } from "@/hooks/useEarnPosition";
import { useEarnDeposit } from "@/hooks/useEarnDeposit";
import { useEarnVaultApys } from "@/hooks/useEarnVaultApys";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import { useVoiBridgeConfigured } from "@/hooks/useVoiBridgeConfigured";
import { useXChainExecutionStatus } from "@/hooks/useXChainExecutionStatus";
import { walletUsdcBalanceQueryKey } from "@/hooks/useWalletUsdcBalance";
import { getXChainExecutionStatusFn } from "@/lib/api/dorkfi.functions";
import { fetchWalletUsdcBalance } from "@/lib/privy/usdcBalance";
import { getAutoEarnDestination } from "@/lib/privy/profile";
import {
  resolveAutoEarnTarget,
  type AutoEarnDestination,
  type ResolvedAutoEarnTarget,
} from "@/lib/stash/auto-earn";
import { getEarnVaultName } from "@/lib/privy/vaults";
import { appendActivity, earnTargetNote } from "@/lib/stash/activity";
import { waitForExecutionUsdcBalance } from "@/lib/stash/wait-for-voi-usdc";
import { validateEvmAddress } from "@/lib/xchain/validate";

const USDC_EPSILON = 0.000_001;

export function useAutoEarn(walletAddress: string | undefined) {
  const { user } = usePrivy();
  const queryClient = useQueryClient();
  const preference = getAutoEarnDestination(user);
  const { configured: earnConfigured } = useEarnVaultDetails();
  const { apyDecimals: earnVaultApyDecimals } = useEarnVaultApys();
  const { supplyApyDecimal } = useDorkFiSupplyApy();
  const { deposit: depositToEarn } = useEarnDeposit(walletAddress);
  const { depositUsdc: depositToDorkFi } = useDorkfiUsdcDeposit(walletAddress);
  const { bridgeUsdc } = useBridgeUsdcToVoi(walletAddress);
  const { status: executionStatus } = useXChainExecutionStatus(walletAddress);
  const { configured: voiBridgeConfigured } = useVoiBridgeConfigured();

  const dorkFiExecutionReady =
    executionStatus != null &&
    executionStatus.usdcOptedIn &&
    executionStatus.spendableVoi >= executionStatus.minSpendableVoiForDeposit;

  const dorkFiUsdcBalance = executionStatus?.usdcBalance ?? 0;
  const dorkFiReady = dorkFiExecutionReady && dorkFiUsdcBalance > 0;

  const resolvedTarget = resolveAutoEarnTarget({
    preference,
    earnVaultApyDecimals,
    dorkFiApyDecimal: supplyApyDecimal,
    earnConfigured,
    dorkFiExecutionReady,
    voiBridgeConfigured,
    dorkFiUsdcBalance,
  });

  const invalidateBalances = useCallback(
    async (normalizedAddress: string) => {
      await queryClient.invalidateQueries({
        queryKey: walletUsdcBalanceQueryKey(normalizedAddress),
      });
      await invalidateEarnPositionQueries(queryClient, normalizedAddress);
      await queryClient.invalidateQueries({
        queryKey: dorkFiUsdcPositionQueryKey(normalizedAddress),
      });
      await queryClient.invalidateQueries({ queryKey: ["xchain-execution-status"] });
    },
    [queryClient],
  );

  const bridgeDepositToVoiIfNeeded = useCallback(
    async (normalizedAddress: `0x${string}`, amount: number) => {
      const status = await getXChainExecutionStatusFn({
        data: { evmAddress: normalizedAddress },
      });
      const existingVoiUsdc = status.usdcBalance;
      const bridgeAmount = Math.max(0, amount - existingVoiUsdc);

      if (bridgeAmount <= USDC_EPSILON) {
        return existingVoiUsdc;
      }

      const walletUsdc = await fetchWalletUsdcBalance(normalizedAddress);
      if (walletUsdc + USDC_EPSILON < bridgeAmount) {
        throw new Error(
          `Waiting for ${bridgeAmount.toFixed(2)} USDC on Base before bridging to Voi (have ${walletUsdc.toFixed(2)}).`,
        );
      }

      await bridgeUsdc(bridgeAmount);
      return waitForExecutionUsdcBalance({
        evmAddress: normalizedAddress,
        minUsdc: existingVoiUsdc + bridgeAmount - USDC_EPSILON,
      });
    },
    [bridgeUsdc],
  );

  const applyAutoEarn = useCallback(
    async (
      amount: number,
      options?: {
        notify?: boolean;
        preferenceOverride?: AutoEarnDestination;
      },
    ): Promise<ResolvedAutoEarnTarget | null> => {
      if (!walletAddress) return null;

      const validation = validateEvmAddress(walletAddress);
      if (!validation.valid) return null;

      const target = resolveAutoEarnTarget({
        preference: options?.preferenceOverride ?? preference,
        earnVaultApyDecimals,
        dorkFiApyDecimal: supplyApyDecimal,
        earnConfigured,
        dorkFiExecutionReady,
        voiBridgeConfigured,
        dorkFiUsdcBalance,
      });

      if (!target) {
        if (options?.notify) {
          toast.message("Auto earn skipped", {
            description: "No yield destination is ready for this deposit yet.",
          });
        }
        return null;
      }

      try {
        if (target !== "dorkfi") {
          const action = await depositToEarn(amount, target);
          if (action && options?.notify) {
            toast.success(`USDC is now earning in ${getEarnVaultName(target)}.`);
          }
        } else {
          await bridgeDepositToVoiIfNeeded(validation.normalized, amount);
          await depositToDorkFi();
          if (options?.notify) {
            toast.success("USDC moved to Voi and supplied to DorkFi.");
          }
        }

        await invalidateBalances(validation.normalized);
        appendActivity(validation.normalized, {
          type: "earn",
          amount,
          note: earnTargetNote(target),
        });
        return target;
      } catch {
        if (options?.notify) {
          toast.message("Deposit received", {
            description: target !== "dorkfi"
              ? `USDC may still be settling on Base before it can enter ${getEarnVaultName(target)}.`
              : "Could not move USDC to Voi or supply to DorkFi yet. Check your execution address and Base wallet balance.",
          });
        }
        return null;
      }
    },
    [
      walletAddress,
      preference,
      earnVaultApyDecimals,
      supplyApyDecimal,
      earnConfigured,
      dorkFiExecutionReady,
      voiBridgeConfigured,
      dorkFiUsdcBalance,
      depositToEarn,
      bridgeDepositToVoiIfNeeded,
      depositToDorkFi,
      invalidateBalances,
    ],
  );

  return {
    preference,
    resolvedTarget,
    dorkFiReady,
    dorkFiExecutionReady,
    applyAutoEarn,
  };
}
