import { usePrivy } from "@privy-io/react-auth";
import { useCallback, useState } from "react";

import { usePrivyWalletActionSigner } from "@/hooks/usePrivyWalletActionSigner";
import {
  executeVoiBridgeTransferFn,
  prepareVoiBridgeTransferFn,
} from "@/lib/api/voi-bridge.functions";
import { usdcToAtomic } from "@/lib/privy/earn-amount";
import type { VoiBridgeTransferResult } from "@/lib/stash/voi-bridge.server";
import { validateEvmAddress } from "@/lib/xchain/validate";

export function useBridgeUsdcToVoi(walletAddress: string | undefined) {
  const { getAccessToken } = usePrivy();
  const { signWalletAction } = usePrivyWalletActionSigner();
  const [isBridging, setIsBridging] = useState(false);
  const [result, setResult] = useState<VoiBridgeTransferResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bridgeUsdc = useCallback(
    async (amount: number): Promise<VoiBridgeTransferResult> => {
      if (!walletAddress) {
        throw new Error("Connect an EVM wallet first.");
      }

      const validation = validateEvmAddress(walletAddress);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Enter an amount greater than zero.");
      }

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in to bridge USDC to Voi.");
      }

      setError(null);
      setResult(null);
      setIsBridging(true);

      try {
        const rawAmount = usdcToAtomic(amount);
        const prepared = await prepareVoiBridgeTransferFn({
          data: {
            accessToken,
            evmAddress: validation.normalized,
            rawAmount,
          },
        });
        const clientAuth = await signWalletAction(prepared.path, prepared.body);
        const bridged = await executeVoiBridgeTransferFn({
          data: {
            accessToken,
            evmAddress: validation.normalized,
            rawAmount,
            clientAuth,
            signedBody: prepared.body,
          },
        });
        setResult(bridged);
        return bridged;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Bridge to Voi failed.";
        setError(message);
        throw err instanceof Error ? err : new Error(message);
      } finally {
        setIsBridging(false);
      }
    },
    [walletAddress, getAccessToken, signWalletAction],
  );

  return {
    bridgeUsdc,
    isBridging,
    result,
    error,
  };
}
