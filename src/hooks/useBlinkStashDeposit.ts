import { usePrivy } from "@privy-io/react-auth";
import {
  Deposit,
  DepositError,
  getDisplayMessage,
  type DepositResult,
  type DepositStatus,
  type SignerRequest,
  type SignerResponse,
} from "@swype-org/deposit";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { useBlinkConfigured } from "@/hooks/useBlinkConfigured";
import { useAutoEarn } from "@/hooks/useAutoEarn";
import { walletUsdcBalanceQueryKey } from "@/hooks/useWalletUsdcBalance";
import { getBlinkDepositTarget, getBlinkMerchantIdClient } from "@/lib/blink/config";
import { fetchWalletUsdcBalance } from "@/lib/privy/usdcBalance";
import { validateEvmAddress } from "@/lib/xchain/validate";
import { toast } from "sonner";

const BLINK_SIGNER_PATH = "/api/blink/sign-payment";
/** Same-chain Base deposits should finish quickly; fail fast with actionable errors. */
const BLINK_FLOW_TIMEOUT_MS = 120_000;
const BLINK_EARN_POLL_MS = 5_000;
const BLINK_EARN_MAX_WAIT_MS = 300_000;

export function useBlinkStashDeposit(walletAddress: string | undefined) {
  const { getAccessToken } = usePrivy();
  const queryClient = useQueryClient();
  const { applyAutoEarn } = useAutoEarn(walletAddress);
  const { configured, environment } = useBlinkConfigured();
  const depositTarget = getBlinkDepositTarget(environment);
  const merchantId = getBlinkMerchantIdClient();

  const depositRef = useRef<Deposit | null>(null);
  const getAccessTokenRef = useRef(getAccessToken);
  getAccessTokenRef.current = getAccessToken;

  const [depositReady, setDepositReady] = useState(false);
  const [status, setStatus] = useState<DepositStatus>("idle");
  const [result, setResult] = useState<DepositResult | null>(null);
  const [error, setError] = useState<DepositError | null>(null);

  const signer = useCallback(async (request: SignerRequest): Promise<SignerResponse> => {
    const accessToken = await getAccessTokenRef.current();
    if (!accessToken) {
      throw new DepositError("SIGNER_REQUEST_FAILED", "Sign in to deposit with Blink.");
    }

    const response = await fetch(BLINK_SIGNER_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    });

    const body = (await response.json().catch(() => null)) as
      | SignerResponse
      | { error?: string }
      | null;

    if (!response.ok) {
      const detail =
        body && typeof body === "object" && "error" in body && body.error
          ? body.error
          : `Signer returned HTTP ${response.status}.`;
      throw new DepositError("SIGNER_REQUEST_FAILED", detail);
    }

    return body as SignerResponse;
  }, []);

  useEffect(() => {
    if (!configured || !merchantId) {
      depositRef.current = null;
      setDepositReady(false);
      setStatus("idle");
      setResult(null);
      setError(null);
      return;
    }

    const deposit = new Deposit({
      signer,
      merchantId,
      environment,
      // Skip the guest / manual-transfer entry screen — use connected-wallet flow.
      enableFullWidget: false,
      // Warm preload can race with transfer-complete postMessage in dev.
      preload: false,
      debug: import.meta.env.DEV,
      signerTimeoutMs: 30_000,
      flowTimeoutMs: BLINK_FLOW_TIMEOUT_MS,
    });
    depositRef.current = deposit;
    setDepositReady(true);

    const onStatusChange = (next: DepositStatus) => setStatus(next);
    const onComplete = (next: DepositResult) => {
      setResult(next);
      setError(null);
    };
    const onError = (next: DepositError) => setError(next);

    deposit.on("status-change", onStatusChange);
    deposit.on("complete", onComplete);
    deposit.on("error", onError);

    return () => {
      deposit.off("status-change", onStatusChange);
      deposit.off("complete", onComplete);
      deposit.off("error", onError);
      deposit.destroy();
      if (depositRef.current === deposit) {
        depositRef.current = null;
      }
      setDepositReady(false);
    };
  }, [configured, merchantId, environment, signer]);

  const invalidateBalances = useCallback(
    async (normalizedAddress: string) => {
      await queryClient.invalidateQueries({
        queryKey: walletUsdcBalanceQueryKey(normalizedAddress),
      });
    },
    [queryClient],
  );

  const scheduleAutoEarnAfterBlink = useCallback(
    (amount: number, normalizedAddress: `0x${string}`) => {
      void (async () => {
        const start = Date.now();
        while (Date.now() - start < BLINK_EARN_MAX_WAIT_MS) {
          try {
            const balance = await fetchWalletUsdcBalance(normalizedAddress);
            if (balance >= amount) {
              const target = await applyAutoEarn(amount, { notify: true });
              if (target) return;
            }
          } catch {
            // USDC may still be bridging into the Privy wallet.
          }
          await new Promise((resolve) => setTimeout(resolve, BLINK_EARN_POLL_MS));
        }

        toast.message("Blink deposit received", {
          description:
            "USDC may still be settling on Base. Auto earn will run once it lands in your wallet.",
        });
      })();
    },
    [applyAutoEarn],
  );

  const depositWithBlink = useCallback(
    async (amount: number) => {
      const deposit = depositRef.current;
      if (!configured || !merchantId || !deposit) {
        return {
          ok: false as const,
          error: depositReady
            ? "Blink is still starting. Try again in a moment."
            : "Blink is not configured.",
        };
      }

      if (!walletAddress) {
        return { ok: false as const, error: "Connect a wallet first." };
      }

      const validation = validateEvmAddress(walletAddress);
      if (!validation.valid) {
        return { ok: false as const, error: validation.error };
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        return { ok: false as const, error: "Enter an amount greater than zero." };
      }

      try {
        const depositResult = await deposit.requestDeposit({
          amount,
          chainId: depositTarget.chainId,
          address: validation.normalized,
          token: depositTarget.token,
        });

        const depositedAmount = depositResult.preview?.amount ?? amount;
        await invalidateBalances(validation.normalized);
        scheduleAutoEarnAfterBlink(depositedAmount, validation.normalized);

        return { ok: true as const };
      } catch (err) {
        if (err instanceof DepositError) {
          if (err.code === "FLOW_TIMEOUT") {
            return {
              ok: false as const,
              error:
                "Blink timed out. In the wallet you connected inside Blink, confirm you have ETH on Base for gas and check for a pending approval (browser extension icon or wallet app).",
            };
          }
          return { ok: false as const, error: err.message };
        }
        const message = err instanceof Error ? err.message : "Blink deposit failed.";
        return { ok: false as const, error: message };
      }
    },
    [
      configured,
      merchantId,
      depositReady,
      walletAddress,
      depositTarget.chainId,
      depositTarget.token,
      scheduleAutoEarnAfterBlink,
      invalidateBalances,
    ],
  );

  const cancelBlink = useCallback(() => {
    depositRef.current?.close();
  }, []);

  const displayMessage = error ? getDisplayMessage(error) : null;
  const isActive = status === "signer-loading" || status === "iframe-active";

  return {
    configured,
    depositReady,
    depositWithBlink,
    cancelBlink,
    status,
    isActive,
    displayMessage,
    loading: isActive,
  };
}
