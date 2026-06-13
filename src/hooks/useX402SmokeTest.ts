import { useSignTypedData } from "@privy-io/react-auth";
import { useCallback, useState } from "react";

import { validateEvmAddress } from "@/lib/xchain/validate";
import {
  fetchWithX402Payment,
  formatX402ClientError,
  getX402ProtectedSmokeTestUrl,
  X402_SMOKE_TEST_AMOUNT,
} from "@/lib/x402/client";

export type X402SmokeTestResult = {
  resource: string;
  message: string;
  timestamp?: string;
  voiUsdc?: {
    recipient?: string;
    amountAtomic?: string;
    txId?: string;
    skipped?: string;
    error?: string;
  };
};

export function useX402SmokeTest(walletAddress: string | undefined) {
  const { signTypedData } = useSignTypedData();
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
      const response = await fetchWithX402Payment(
        getX402ProtectedSmokeTestUrl(),
        validation.normalized,
        async (input, options) => {
          const { signature } = await signTypedData(
            {
              domain: input.domain,
              types: input.types,
              primaryType: input.primaryType,
              message: input.message,
            },
            { address: options?.address },
          );
          return { signature };
        },
      );

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 402 && body.trim() === "{}") {
          throw new Error(
            "Payment was not accepted after signing. The server did not receive a valid payment header.",
          );
        }
        throw new Error(formatX402ClientError(new Error(`HTTP ${response.status}`), body));
      }

      const data = (await response.json()) as X402SmokeTestResult;
      setResult(data);
    } catch (err) {
      setError(formatX402ClientError(err));
    } finally {
      setIsRunning(false);
    }
  }, [walletAddress, signTypedData]);

  return {
    runSmokeTest,
    isRunning,
    result,
    error,
    amount: X402_SMOKE_TEST_AMOUNT,
  };
}
