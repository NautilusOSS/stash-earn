import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import { earnDepositFn, prepareEarnDepositFn } from "@/lib/api/earn.functions";
import { usdcToAtomic } from "@/lib/privy/earn-amount";
import type { EarnAction } from "@/lib/privy/earn.types";
import { earnPositionQueryKey } from "@/hooks/useEarnPosition";
import { getVaultId } from "@/lib/privy/constants";
import { usePrivyWalletActionSigner } from "@/hooks/usePrivyWalletActionSigner";
import { walletUsdcBalanceQueryKey } from "@/hooks/useWalletUsdcBalance";
import { validateEvmAddress } from "@/lib/xchain/validate";

export function useEarnDeposit(walletAddress: string | undefined) {
  const { getAccessToken } = usePrivy();
  const { signWalletAction } = usePrivyWalletActionSigner();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastAction, setLastAction] = useState<EarnAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deposit = useCallback(
    async (amount: number, vaultId?: string) => {
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
        setError("Sign in to deposit.");
        return null;
      }

      setError(null);
      setLastAction(null);
      setIsSubmitting(true);

      try {
        const rawAmount = usdcToAtomic(amount);
        const resolvedVaultId = vaultId ?? getVaultId();
        const prepared = (await prepareEarnDepositFn({
          data: {
            accessToken,
            evmAddress: validation.normalized,
            rawAmount,
            vaultId: resolvedVaultId,
          },
        })) as { path: string; body: Record<string, unknown> };
        const clientAuth = await signWalletAction(prepared.path, prepared.body);

        const { action } = await earnDepositFn({
          data: {
            accessToken,
            evmAddress: validation.normalized,
            rawAmount,
            vaultId: resolvedVaultId,
            clientAuth,
            signedBody: prepared.body,
          },
        });

        if (action.status === "failed" || action.status === "rejected") {
          throw new Error(
            action.status === "rejected"
              ? "Deposit was rejected. Check your balance and try again."
              : "Deposit failed onchain. Try a smaller amount.",
          );
        }

        setLastAction(action);
        await queryClient.invalidateQueries({
          queryKey: earnPositionQueryKey(validation.normalized, resolvedVaultId),
        });
        await queryClient.invalidateQueries({
          queryKey: walletUsdcBalanceQueryKey(validation.normalized),
        });
        return action;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Deposit failed.";
        setError(message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [walletAddress, getAccessToken, queryClient, signWalletAction],
  );

  return { deposit, isSubmitting, lastAction, error };
}
