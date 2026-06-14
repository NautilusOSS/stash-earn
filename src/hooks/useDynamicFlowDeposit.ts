import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";

import { createFlowDepositFn } from "@/lib/api/dynamic.functions";
import type { DynamicEvmChain, DynamicEvmToken } from "@/lib/dynamic/chains";
import {
  attachDynamicFlowSource,
  broadcastDynamicFlowTransaction,
  cancelDynamicFlowTransaction,
  DynamicFlowApiError,
  getDynamicFlowQuote,
  getDynamicFlowTransaction,
  getSettledUsdcAmount,
  isDynamicFlowSuccess,
  isDynamicFlowTerminal,
  prepareDynamicFlowTransaction,
  waitForDynamicRiskCleared,
} from "@/lib/dynamic/flow-api";
import {
  connectInjectedWallet,
  signAndBroadcastDynamicEvmPayload,
  switchInjectedChain,
} from "@/lib/dynamic/sign-evm";
import type { DynamicFlowDepositSession, DynamicFlowQuote } from "@/lib/dynamic/types";
import { useAutoEarn } from "@/hooks/useAutoEarn";
import { walletUsdcBalanceQueryKey } from "@/hooks/useWalletUsdcBalance";
import { fetchWalletUsdcBalance } from "@/lib/privy/usdcBalance";
import { validateEvmAddress } from "@/lib/xchain/validate";
import { toast } from "sonner";

const FLOW_SETTLE_POLL_MS = 3_000;
const FLOW_SETTLE_MAX_WAIT_MS = 600_000;
const FLOW_EARN_POLL_MS = 5_000;
const FLOW_EARN_MAX_WAIT_MS = 300_000;

export type DynamicFlowStep =
  | "idle"
  | "creating"
  | "wallet"
  | "token"
  | "quoting"
  | "review"
  | "signing"
  | "settling"
  | "done"
  | "failed";

function formatFlowError(err: unknown): string {
  if (err instanceof DynamicFlowApiError) {
    if (err.status === 403) {
      return "This wallet cannot be used for deposits. Try a different wallet.";
    }
    if (err.status === 422) {
      return err.message;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Deposit could not be completed.";
}

export function useDynamicFlowDeposit(walletAddress: string | undefined) {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const { applyAutoEarn } = useAutoEarn(walletAddress);

  const sessionRef = useRef<DynamicFlowDepositSession | null>(null);
  const cancelRef = useRef(false);

  const [step, setStep] = useState<DynamicFlowStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [sourceAddress, setSourceAddress] = useState<`0x${string}` | null>(null);
  const [sourceChain, setSourceChain] = useState<DynamicEvmChain | null>(null);
  const [selectedToken, setSelectedToken] = useState<DynamicEvmToken | null>(null);
  const [quote, setQuote] = useState<DynamicFlowQuote | null>(null);

  const reset = useCallback(() => {
    sessionRef.current = null;
    cancelRef.current = false;
    setStep("idle");
    setError(null);
    setSourceAddress(null);
    setSourceChain(null);
    setSelectedToken(null);
    setQuote(null);
  }, []);

  const invalidateBalances = useCallback(
    async (normalizedAddress: string) => {
      await queryClient.invalidateQueries({
        queryKey: walletUsdcBalanceQueryKey(normalizedAddress),
      });
    },
    [queryClient],
  );

  const scheduleAutoEarnAfterSettlement = useCallback(
    (amount: number, normalizedAddress: `0x${string}`) => {
      void (async () => {
        const start = Date.now();
        while (Date.now() - start < FLOW_EARN_MAX_WAIT_MS) {
          try {
            const balance = await fetchWalletUsdcBalance(normalizedAddress);
            if (balance >= amount) {
              const target = await applyAutoEarn(amount, { notify: true });
              if (target) return;
            }
          } catch {
            // USDC may still be settling on Base.
          }
          await new Promise((resolve) => setTimeout(resolve, FLOW_EARN_POLL_MS));
        }

        toast.message("Deposit received", {
          description:
            "USDC may still be settling on Base. Auto earn will run once it lands in your wallet.",
        });
      })();
    },
    [applyAutoEarn],
  );

  const startDeposit = useCallback(
    async (amount: number) => {
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

      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError("Sign in to deposit.");
        return false;
      }

      setError(null);
      setStep("creating");

      try {
        const session = await createFlowDepositFn({
          data: {
            accessToken,
            amount: amount.toFixed(2),
            destinationAddress: validation.normalized,
          },
        });

        sessionRef.current = {
          transactionId: session.transactionId,
          sessionToken: session.sessionToken,
          sessionExpiresAt: session.sessionExpiresAt,
          environmentId: session.environmentId,
          amount: session.amount,
          destinationAddress: session.destinationAddress,
        };

        setStep("wallet");
        return true;
      } catch (err) {
        setError(formatFlowError(err));
        setStep("failed");
        return false;
      }
    },
    [walletAddress, getAccessToken],
  );

  const connectSourceWallet = useCallback(async () => {
    const session = sessionRef.current;
    if (!session) {
      setError("Start the deposit again.");
      return false;
    }

    setError(null);

    try {
      const { address } = await connectInjectedWallet();
      setSourceAddress(address);
      setStep("token");
      return true;
    } catch (err) {
      setError(formatFlowError(err));
      return false;
    }
  }, []);

  const selectSourceChain = useCallback((chain: DynamicEvmChain) => {
    setSourceChain(chain);
    setSelectedToken(null);
    setQuote(null);
  }, []);

  const requestQuote = useCallback(
    async (token: DynamicEvmToken) => {
      const session = sessionRef.current;
      if (!session || !sourceAddress || !sourceChain) {
        setError("Connect a wallet and pick a network first.");
        return false;
      }

      setError(null);
      setSelectedToken(token);
      setStep("quoting");

      try {
        await switchInjectedChain(sourceChain.chainId);

        await attachDynamicFlowSource({
          environmentId: session.environmentId,
          transactionId: session.transactionId,
          sessionToken: session.sessionToken,
          fromAddress: sourceAddress,
          fromChainId: String(sourceChain.chainId),
          fromChainName: "EVM",
        });

        const quoted = await getDynamicFlowQuote({
          environmentId: session.environmentId,
          transactionId: session.transactionId,
          sessionToken: session.sessionToken,
          fromTokenAddress: token.address,
        });

        if (!quoted.quote) {
          throw new Error("No quote returned for this token.");
        }

        setQuote(quoted.quote);
        setStep("review");
        return true;
      } catch (err) {
        setError(formatFlowError(err));
        setStep("token");
        return false;
      }
    },
    [sourceAddress, sourceChain],
  );

  const confirmAndSign = useCallback(async () => {
    const session = sessionRef.current;
    if (!session || !sourceAddress || !quote) {
      setError("Quote expired. Pick a token again.");
      return false;
    }

    setError(null);
    setStep("signing");
    cancelRef.current = false;

    try {
      let prepared = await prepareDynamicFlowTransaction({
        environmentId: session.environmentId,
        transactionId: session.transactionId,
        sessionToken: session.sessionToken,
      });

      if (prepared.riskState !== "cleared") {
        await waitForDynamicRiskCleared({
          environmentId: session.environmentId,
          transactionId: session.transactionId,
        });
        prepared = await prepareDynamicFlowTransaction({
          environmentId: session.environmentId,
          transactionId: session.transactionId,
          sessionToken: session.sessionToken,
        });
      }

      const signingPayload = prepared.quote?.signingPayload;
      if (!signingPayload) {
        throw new Error("Missing signing payload.");
      }

      const txHash = await signAndBroadcastDynamicEvmPayload({
        signingPayload,
        fromAddress: sourceAddress,
      });

      await broadcastDynamicFlowTransaction({
        environmentId: session.environmentId,
        transactionId: session.transactionId,
        sessionToken: session.sessionToken,
        txHash,
      });

      setStep("settling");
      const settledAmount = Number.parseFloat(getSettledUsdcAmount(quote, session.amount));

      const settleStart = Date.now();
      while (Date.now() - settleStart < FLOW_SETTLE_MAX_WAIT_MS) {
        if (cancelRef.current) return false;

        const tx = await getDynamicFlowTransaction({
          environmentId: session.environmentId,
          transactionId: session.transactionId,
        });

        if (isDynamicFlowSuccess(tx)) {
          await invalidateBalances(session.destinationAddress);
          scheduleAutoEarnAfterSettlement(settledAmount, session.destinationAddress);
          setStep("done");
          return true;
        }

        if (isDynamicFlowTerminal(tx) && !isDynamicFlowSuccess(tx)) {
          throw new Error(
            `Deposit failed (execution=${tx.executionState}, settlement=${tx.settlementState}).`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, FLOW_SETTLE_POLL_MS));
      }

      throw new Error(
        "Settlement is taking longer than expected. Check your wallet balance shortly.",
      );
    } catch (err) {
      if (
        err instanceof DynamicFlowApiError &&
        err.status === 422 &&
        err.message.includes("expired")
      ) {
        setError("Quote expired. Pick a token again to get a new quote.");
        setStep("token");
        setQuote(null);
        return false;
      }
      setError(formatFlowError(err));
      setStep("review");
      return false;
    }
  }, [sourceAddress, quote, invalidateBalances, scheduleAutoEarnAfterSettlement]);

  const cancelFlow = useCallback(async () => {
    cancelRef.current = true;
    const session = sessionRef.current;
    if (!session) {
      reset();
      return;
    }

    try {
      await cancelDynamicFlowTransaction({
        environmentId: session.environmentId,
        transactionId: session.transactionId,
        sessionToken: session.sessionToken,
      });
    } catch {
      // May already be past cancellable state.
    }

    reset();
  }, [reset]);

  const isBusy =
    step === "creating" || step === "quoting" || step === "signing" || step === "settling";

  return {
    step,
    error,
    sourceAddress,
    sourceChain,
    selectedToken,
    quote,
    isBusy,
    startDeposit,
    connectSourceWallet,
    selectSourceChain,
    requestQuote,
    confirmAndSign,
    cancelFlow,
    reset,
  };
}
