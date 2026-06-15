import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { earnWithdrawFn, prepareEarnWithdrawFn } from "@/lib/api/earn.functions";
import { earnPositionQueryKey } from "@/hooks/useEarnPosition";
import { usePrivyWalletActionSigner } from "@/hooks/usePrivyWalletActionSigner";
import { walletUsdcBalanceQueryKey } from "@/hooks/useWalletUsdcBalance";
import { usdcToAtomic, atomicToUsdc } from "@/lib/privy/earn-amount";
import { hasWithdrawAddress } from "@/lib/privy/profile";
import { appendActivity } from "@/lib/stash/activity";
import { truncateAddress } from "@/lib/privy/constants";
import type {
  StashWithdrawPrepareResult,
  StashWithdrawSignedAction,
} from "@/lib/privy/stash-withdraw.types";
import { validateEvmAddress } from "@/lib/xchain/validate";

export type WithdrawResult = {
  destinationAddress: string;
};

export function useEarnWithdraw(walletAddress: string | undefined) {
  const { getAccessToken, user } = usePrivy();
  const { signWalletAction } = usePrivyWalletActionSigner();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<WithdrawResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const withdrawAddressConfigured = hasWithdrawAddress(user);

  const withdraw = useCallback(
    async (amount: number, rawAmountOverride?: string) => {
      if (!withdrawAddressConfigured) {
        setError("Set a Base withdraw address in Account first.");
        return null;
      }

      if (!walletAddress) {
        setError("Connect a wallet first.");
        return null;
      }

      const validation = validateEvmAddress(walletAddress);
      if (!validation.valid) {
        setError(validation.error);
        return null;
      }

      const rawAmount = rawAmountOverride ?? usdcToAtomic(amount);
      if (rawAmount === "0" || BigInt(rawAmount) <= 0n) {
        setError("Enter an amount greater than zero.");
        return null;
      }

      if (!rawAmountOverride && (!Number.isFinite(amount) || amount <= 0)) {
        setError("Enter an amount greater than zero.");
        return null;
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to withdraw.");
        return null;
      }

      setError(null);
      setLastResult(null);
      setIsSubmitting(true);

      try {
        const prepared = (await prepareEarnWithdrawFn({
          data: {
            accessToken,
            evmAddress: validation.normalized,
            rawAmount,
          },
        })) as StashWithdrawPrepareResult;

        const signedActions: StashWithdrawSignedAction[] = [];
        for (const action of prepared.actions) {
          const auth = await signWalletAction(action.path, action.body);
          signedActions.push({ ...action, ...auth });
        }

        const result = await earnWithdrawFn({
          data: {
            accessToken,
            evmAddress: validation.normalized,
            rawAmount,
            signedActions,
          },
        });

        if (
          result.withdrawAction &&
          (result.withdrawAction.status === "failed" ||
            result.withdrawAction.status === "rejected")
        ) {
          throw new Error(
            result.withdrawAction.status === "rejected"
              ? "Vault withdrawal was rejected. Try a smaller amount."
              : "Vault withdrawal failed onchain.",
          );
        }

        const withdrawResult: WithdrawResult = {
          destinationAddress: result.destinationAddress,
        };
        setLastResult(withdrawResult);
        await queryClient.invalidateQueries({
          queryKey: earnPositionQueryKey(validation.normalized),
        });
        await queryClient.invalidateQueries({
          queryKey: walletUsdcBalanceQueryKey(validation.normalized),
        });

        const withdrawnAmount = rawAmountOverride
          ? atomicToUsdc(rawAmount)
          : amount;
        appendActivity(validation.normalized, {
          type: "withdrawal",
          amount: withdrawnAmount,
          note: `To ${truncateAddress(result.destinationAddress)}`,
        });

        return withdrawResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Withdrawal failed.";
        setError(message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      walletAddress,
      getAccessToken,
      queryClient,
      withdrawAddressConfigured,
      signWalletAction,
    ],
  );

  return {
    withdraw,
    isSubmitting,
    lastResult,
    error,
    withdrawAddressConfigured,
    destinationLabel: lastResult
      ? truncateAddress(lastResult.destinationAddress)
      : null,
  };
}
