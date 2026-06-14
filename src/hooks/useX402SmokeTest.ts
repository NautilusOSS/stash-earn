import { useWallets } from "@privy-io/react-auth";
import { useCallback, useState } from "react";
import { getAddress, isAddressEqual } from "viem";

import { validateEvmAddress } from "@/lib/xchain/validate";
import {
  fetchWithX402Payment,
  formatX402ClientError,
  getX402ProtectedSmokeTestUrl,
  parseX402DollarAmount,
  type X402BridgeResponse,
  X402_SMOKE_TEST_AMOUNT,
} from "@/lib/x402/client";
import { createPrivyX402Signer } from "@/lib/x402/privy-signer";
import { fetchWalletUsdcBalance } from "@/lib/privy/usdcBalance";

export type X402SmokeTestResult = X402BridgeResponse;

export function useX402SmokeTest(walletAddress: string | undefined) {
  const { wallets } = useWallets();
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<X402SmokeTestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSmokeTest = useCallback(async () => {
    if (!walletAddress) {
      setError("Connect an EVM wallet first");
      return;
    }

    const validation = validateEvmAddress(walletAddress);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setError(null);
    setResult(null);
    setIsRunning(true);

    try {
      const payer = getAddress(validation.normalized);
      const wallet = wallets.find((w) => isAddressEqual(getAddress(w.address), payer));
      if (!wallet) {
        throw new Error("Embedded Privy wallet not found. Reconnect your wallet and retry.");
      }

      const requiredUsdc = parseX402DollarAmount(X402_SMOKE_TEST_AMOUNT);
      const walletUsdc = await fetchWalletUsdcBalance(payer);
      if (walletUsdc < requiredUsdc) {
        throw new Error(
          `Need at least ${X402_SMOKE_TEST_AMOUNT} Base USDC in your embedded wallet (have ${walletUsdc.toFixed(2)}). ` +
            "x402 cannot spend USDC in the Earn vault — withdraw to wallet or fund the wallet first.",
        );
      }

      const signer = await createPrivyX402Signer(wallet);
      const response = await fetchWithX402Payment(
        getX402ProtectedSmokeTestUrl(),
        payer,
        signer,
      );

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 402 && body.trim() === "{}") {
          throw new Error(
            "Payment was not accepted after signing. The server did not receive a valid payment header.",
          );
        }
        throw new Error(
          formatX402ClientError(new Error(`HTTP ${response.status}`), body, {
            clientUsdcReady: walletUsdc >= requiredUsdc,
          }),
        );
      }

      const data = (await response.json()) as X402SmokeTestResult;
      setResult(data);
    } catch (err) {
      setError(formatX402ClientError(err));
    } finally {
      setIsRunning(false);
    }
  }, [walletAddress, wallets]);

  return {
    runSmokeTest,
    isRunning,
    result,
    error,
    amount: X402_SMOKE_TEST_AMOUNT,
  };
}
