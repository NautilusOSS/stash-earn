import { useFundWallet } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { base } from "viem/chains";

import { earnPositionQueryKey } from "@/hooks/useEarnPosition";
import { walletUsdcBalanceQueryKey } from "@/hooks/useWalletUsdcBalance";
import { useEarnDeposit } from "@/hooks/useEarnDeposit";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import { validateEvmAddress } from "@/lib/xchain/validate";

export type StashDepositMethod = "fiat" | "external";

export function useStashDeposit(walletAddress: string | undefined) {
  const queryClient = useQueryClient();
  const { fundWallet } = useFundWallet();
  const { deposit: depositToEarn } = useEarnDeposit(walletAddress);
  const { configured: earnConfigured } = useEarnVaultDetails();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidateBalances = useCallback(
    async (normalizedAddress: string) => {
      await queryClient.invalidateQueries({
        queryKey: walletUsdcBalanceQueryKey(normalizedAddress),
      });
      await queryClient.invalidateQueries({
        queryKey: earnPositionQueryKey(normalizedAddress),
      });
    },
    [queryClient],
  );

  const tryEarnDeposit = useCallback(
    async (amount: number) => {
      if (!earnConfigured) return;
      try {
        await depositToEarn(amount);
      } catch {
        // Funding may still be settling before earn deposit.
      }
    },
    [earnConfigured, depositToEarn],
  );

  const deposit = useCallback(
    async (amount: number, method: StashDepositMethod) => {
      if (!walletAddress) {
        setError("Connect a wallet first.");
        return false;
      }

      const validation = validateEvmAddress(walletAddress);
      if (!validation.valid) {
        setError(validation.error);
        return false;
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        setError("Enter an amount greater than zero.");
        return false;
      }

      setError(null);
      setIsSubmitting(true);

      const amountStr = amount.toString();
      const normalized = validation.normalized;

      try {
        await fundWallet({
          address: normalized,
          options: {
            chain: base,
            amount: amountStr,
            asset: "USDC",
            defaultFundingMethod:
              method === "fiat" ? "card" : "wallet",
          },
        });

        await tryEarnDeposit(amount);
        await invalidateBalances(normalized);
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Deposit could not be completed.";
        // User closed the Privy modal — not an error worth surfacing.
        if (
          message.toLowerCase().includes("user exited") ||
          message.toLowerCase().includes("closed")
        ) {
          return false;
        }
        setError(message);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [walletAddress, fundWallet, tryEarnDeposit, invalidateBalances],
  );

  return { deposit, isSubmitting, error };
}
