import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { earnWithdrawFn } from "@/lib/api/earn.functions";
import { usdcToAtomic } from "@/lib/privy/earn-amount";
import type { EarnAction } from "@/lib/privy/earn.types";
import { earnPositionQueryKey } from "@/hooks/useEarnPosition";
import { walletUsdcBalanceQueryKey } from "@/hooks/useWalletUsdcBalance";
import { validateEvmAddress } from "@/lib/xchain/validate";

export function useEarnWithdraw(walletAddress: string | undefined) {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAction, setLastAction] = useState<EarnAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const withdraw = useCallback(
    async (amount: number) => {
      if (!walletAddress) {
        setError("Connect a wallet first.");
        return null;
      }

      const validation = validateEvmAddress(walletAddress);
      if (!validation.valid) {
        setError(validation.error);
        return null;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Enter an amount greater than zero.");
        return null;
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to withdraw.");
        return null;
      }

      setError(null);
      setLastAction(null);
      setIsSubmitting(true);

      try {
        const { action } = await earnWithdrawFn({
          data: {
            accessToken,
            evmAddress: validation.normalized,
            rawAmount: usdcToAtomic(amount),
          },
        });

        if (action.status === "failed" || action.status === "rejected") {
          throw new Error(
            action.status === "rejected"
              ? "Withdrawal was rejected. Try a smaller amount."
              : "Withdrawal failed onchain.",
          );
        }

        setLastAction(action);
        await queryClient.invalidateQueries({
          queryKey: earnPositionQueryKey(validation.normalized),
        });
        await queryClient.invalidateQueries({
          queryKey: walletUsdcBalanceQueryKey(validation.normalized),
        });
        return action;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Withdrawal failed.";
        setError(message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [walletAddress, getAccessToken, queryClient],
  );

  return { withdraw, isSubmitting, lastAction, error };
}
