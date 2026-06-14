import { useFundWallet } from "@privy-io/react-auth";
import { useCallback, useState } from "react";
import { base } from "viem/chains";

import { useAutoEarn } from "@/hooks/useAutoEarn";
import { validateEvmAddress } from "@/lib/xchain/validate";

export type StashDepositMethod = "fiat" | "external";

export function useStashDeposit(walletAddress: string | undefined) {
  const { fundWallet } = useFundWallet();
  const { applyAutoEarn } = useAutoEarn(walletAddress);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

      try {
        await fundWallet({
          address: validation.normalized,
          options: {
            chain: base,
            amount: amountStr,
            asset: "USDC",
            defaultFundingMethod: method === "fiat" ? "card" : "wallet",
          },
        });

        await applyAutoEarn(amount, { notify: true });
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Deposit could not be completed.";
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
    [walletAddress, fundWallet, applyAutoEarn],
  );

  return { deposit, isSubmitting, error };
}
