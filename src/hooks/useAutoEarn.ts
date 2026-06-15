import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";

import { useBridgeUsdcToVoi } from "@/hooks/useBridgeUsdcToVoi";
import { useDorkFiSupplyApy } from "@/hooks/useDorkFiSupplyApy";
import { dorkFiUsdcPositionQueryKey } from "@/hooks/useDorkFiUsdcPosition";
import { useEarnDeposit } from "@/hooks/useEarnDeposit";
import { invalidateEarnPositionQueries } from "@/hooks/useEarnPosition";
import { useEarnVaultApys } from "@/hooks/useEarnVaultApys";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import { useVoiBridgeConfigured } from "@/hooks/useVoiBridgeConfigured";
import { usePrivyWalletActionSigner } from "@/hooks/usePrivyWalletActionSigner";
import { useXChainExecutionStatus } from "@/hooks/useXChainExecutionStatus";
import { useWalletUsdcBalance, walletUsdcBalanceQueryKey } from "@/hooks/useWalletUsdcBalance";
import {
  depositDorkFiUsdcWithClientAuthFn,
  getXChainExecutionStatusFn,
  prepareDorkFiUsdcDepositSignFn,
} from "@/lib/api/dorkfi.functions";
import {
  optInXChainUsdcWithClientAuthFn,
  prepareXChainUsdcOptInSignFn,
} from "@/lib/api/xchain.functions";
import { fetchWalletUsdcBalance } from "@/lib/privy/usdcBalance";
import { getAutoEarnDestination } from "@/lib/privy/profile";
import {
  AUTO_EARN_DESTINATIONS,
  getDorkFiEarnHint,
  isDorkFiEarnAvailable,
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
  const { user, getAccessToken } = usePrivy();
  const { signWalletAction } = usePrivyWalletActionSigner();
  const queryClient = useQueryClient();
  const preference = getAutoEarnDestination(user);
  const { configured: earnConfigured } = useEarnVaultDetails();
  const { apyDecimals: earnVaultApyDecimals } = useEarnVaultApys();
  const { supplyApyDecimal, supplyApyLabel } = useDorkFiSupplyApy();
  const { deposit: depositToEarn } = useEarnDeposit(walletAddress);
  const { bridgeUsdc } = useBridgeUsdcToVoi(walletAddress);
  const { status: executionStatus, isLoading: executionStatusLoading } =
    useXChainExecutionStatus(walletAddress);
  const { configured: voiBridgeConfigured } = useVoiBridgeConfigured();
  const { baseBalance, executionBalance } = useWalletUsdcBalance(walletAddress);

  const dorkFiExecutionReady =
    executionStatus != null &&
    executionStatus.spendableVoi >= executionStatus.minSpendableVoiForDeposit;

  const dorkFiUsdcBalance = executionStatus?.usdcBalance ?? 0;
  const dorkFiUsdcOptedIn = executionStatus?.usdcOptedIn === true;
  const dorkFiReady = dorkFiExecutionReady && dorkFiUsdcBalance > 0 && dorkFiUsdcOptedIn;

  const resolveTargetInput = {
    earnVaultApyDecimals,
    dorkFiApyDecimal: supplyApyDecimal,
    earnConfigured,
    dorkFiExecutionReady,
    usdcOptedIn: dorkFiUsdcOptedIn,
    voiBridgeConfigured,
    dorkFiUsdcBalance,
    walletBaseBalance: baseBalance,
  };

  const resolveForPreference = useCallback(
    (destination: AutoEarnDestination): ResolvedAutoEarnTarget | null =>
      resolveAutoEarnTarget({
        preference: destination,
        ...resolveTargetInput,
      }),
    [
      earnVaultApyDecimals,
      supplyApyDecimal,
      earnConfigured,
      dorkFiExecutionReady,
      dorkFiUsdcOptedIn,
      voiBridgeConfigured,
      dorkFiUsdcBalance,
      baseBalance,
    ],
  );

  const resolvedTarget = resolveForPreference(preference);

  const anyEarnReady = useMemo(
    () => AUTO_EARN_DESTINATIONS.some((destination) => resolveForPreference(destination) != null),
    [resolveForPreference],
  );

  const canSupplyVoiToDorkFi = useMemo(
    () =>
      executionBalance > USDC_EPSILON &&
      isDorkFiEarnAvailable({
        dorkFiExecutionReady,
        usdcOptedIn: dorkFiUsdcOptedIn,
        voiBridgeConfigured,
        dorkFiUsdcBalance,
        walletBaseBalance: baseBalance,
      }),
    [
      executionBalance,
      dorkFiExecutionReady,
      dorkFiUsdcOptedIn,
      voiBridgeConfigured,
      dorkFiUsdcBalance,
      baseBalance,
    ],
  );

  const canEarnFromWallet = useMemo(() => {
    if (baseBalance <= USDC_EPSILON) return false;
    return AUTO_EARN_DESTINATIONS.some(
      (destination) => resolveForPreference(destination) != null,
    );
  }, [baseBalance, resolveForPreference]);

  const getEarnOptionHint = useCallback(
    (destination: AutoEarnDestination): string | null => {
      if (destination !== "dorkfi") return null;

      const available = isDorkFiEarnAvailable({
        dorkFiExecutionReady,
        usdcOptedIn: dorkFiUsdcOptedIn,
        voiBridgeConfigured,
        dorkFiUsdcBalance,
        walletBaseBalance: baseBalance,
      });

      if (executionStatusLoading && voiBridgeConfigured && baseBalance > 0) {
        return getDorkFiEarnHint({
          available: true,
          voiBridgeConfigured,
          dorkFiUsdcBalance,
          walletBaseBalance: baseBalance,
          supplyApyLabel: supplyApyLabel === "…" ? null : supplyApyLabel,
        });
      }

      return getDorkFiEarnHint({
        available: executionStatusLoading ? false : available,
        voiBridgeConfigured,
        dorkFiUsdcBalance,
        walletBaseBalance: baseBalance,
        usdcOptedIn: executionStatus?.usdcOptedIn,
        spendableVoi: executionStatus?.spendableVoi,
        minSpendableVoi: executionStatus?.minSpendableVoiForDeposit,
      });
    },
    [
      dorkFiExecutionReady,
      dorkFiUsdcOptedIn,
      voiBridgeConfigured,
      dorkFiUsdcBalance,
      baseBalance,
      executionStatusLoading,
      executionStatus,
      supplyApyLabel,
    ],
  );

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

  const ensureUsdcOptIn = useCallback(
    async (normalizedAddress: `0x${string}`) => {
      const status = await getXChainExecutionStatusFn({
        data: { evmAddress: normalizedAddress },
      });
      if (status.usdcOptedIn) return;

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in again to opt into USDC on Voi.");
      }

      const prepared = await prepareXChainUsdcOptInSignFn({
        data: { accessToken, evmAddress: normalizedAddress },
      });
      const clientAuth = await signWalletAction(prepared.rpcPath, prepared.rpcBody);

      await optInXChainUsdcWithClientAuthFn({
        data: {
          accessToken,
          evmAddress: normalizedAddress,
          unsignedTxnBase64: prepared.unsignedTxnBase64,
          typedData: prepared.typedData as Record<string, unknown>,
          rpcPath: prepared.rpcPath,
          rpcBody: prepared.rpcBody,
          clientAuth,
        },
      });
      const after = await getXChainExecutionStatusFn({
        data: { evmAddress: normalizedAddress },
      });
      if (!after.usdcOptedIn) {
        throw new Error("USDC opt-in on your Voi execution address did not complete.");
      }
    },
    [getAccessToken, signWalletAction],
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

      const freshStatus = await getXChainExecutionStatusFn({
        data: { evmAddress: validation.normalized },
      });
      const freshWalletUsdc = await fetchWalletUsdcBalance(validation.normalized);
      const freshExecutionReady =
        freshStatus.spendableVoi >= freshStatus.minSpendableVoiForDeposit;

      const target = resolveAutoEarnTarget({
        preference: options?.preferenceOverride ?? preference,
        earnVaultApyDecimals,
        dorkFiApyDecimal: supplyApyDecimal,
        earnConfigured,
        dorkFiExecutionReady: freshExecutionReady,
        usdcOptedIn: freshStatus.usdcOptedIn,
        voiBridgeConfigured,
        dorkFiUsdcBalance: freshStatus.usdcBalance,
        walletBaseBalance: freshWalletUsdc,
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
          const statusBefore = await getXChainExecutionStatusFn({
            data: { evmAddress: validation.normalized },
          });
          const voiOnlySupply =
            statusBefore.usdcBalance > USDC_EPSILON && amount <= statusBefore.usdcBalance + USDC_EPSILON;

          if (!statusBefore.usdcOptedIn) {
            if (options?.notify) {
              toast.message("Opting into USDC on Voi…");
            }
            await ensureUsdcOptIn(validation.normalized);
          }

          const needsBridge = amount > statusBefore.usdcBalance + USDC_EPSILON;
          if (needsBridge) {
            if (options?.notify) {
              toast.message("Moving USDC to Voi…", {
                description: "Bridging from your Base wallet. This can take up to 2 minutes.",
              });
            }
            await bridgeDepositToVoiIfNeeded(validation.normalized, amount);
          }

          const accessToken = await getAccessToken();
          if (!accessToken) {
            throw new Error("Sign in again to supply USDC to DorkFi.");
          }

          if (options?.notify) {
            toast.message("Supplying to DorkFi…");
          }

          const prepared = await prepareDorkFiUsdcDepositSignFn({
            data: { accessToken, evmAddress: validation.normalized },
          });
          const clientAuth = await signWalletAction(prepared.rpcPath, prepared.rpcBody);
          await depositDorkFiUsdcWithClientAuthFn({
            data: {
              accessToken,
              evmAddress: validation.normalized,
              unsignedTxnsBase64: prepared.unsignedTxnsBase64,
              typedData: prepared.typedData as Record<string, unknown>,
              rpcPath: prepared.rpcPath,
              rpcBody: prepared.rpcBody,
              clientAuth,
            },
          });

          if (options?.notify) {
            toast.success(
              voiOnlySupply && !needsBridge
                ? "USDC on Voi is now supplied to DorkFi."
                : "USDC moved to Voi and supplied to DorkFi.",
            );
          }
        }

        await invalidateBalances(validation.normalized);
        appendActivity(validation.normalized, {
          type: "earn",
          amount,
          note: earnTargetNote(target),
        });
        return target;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Earn failed";
        if (options?.notify) {
          toast.error(target === "dorkfi" ? "DorkFi earn failed" : "Earn failed", {
            description: message,
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
      dorkFiUsdcOptedIn,
      baseBalance,
      depositToEarn,
      ensureUsdcOptIn,
      bridgeDepositToVoiIfNeeded,
      getAccessToken,
      signWalletAction,
      invalidateBalances,
    ],
  );

  return {
    preference,
    resolvedTarget,
    resolveForPreference,
    anyEarnReady,
    canEarnFromWallet,
    canSupplyVoiToDorkFi,
    getEarnOptionHint,
    dorkFiReady,
    dorkFiExecutionReady,
    applyAutoEarn,
  };
}
