import { useWallets } from "@privy-io/react-auth";
import { useCallback, useState } from "react";
import { getAddress, isAddressEqual } from "viem";

import {
  bridgeUsdcToVoiViaX402,
  type BridgeUsdcToVoiResult,
} from "@/lib/x402/bridge";
import { validateEvmAddress } from "@/lib/xchain/validate";

export function useBridgeUsdcToVoi(walletAddress: string | undefined) {
  const { wallets } = useWallets();
  const [isBridging, setIsBridging] = useState(false);
  const [result, setResult] = useState<BridgeUsdcToVoiResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bridgeUsdc = useCallback(
    async (amount: number): Promise<BridgeUsdcToVoiResult> => {
      if (!walletAddress) {
        throw new Error("Connect an EVM wallet first.");
      }

      const validation = validateEvmAddress(walletAddress);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const payer = getAddress(validation.normalized);
      const wallet = wallets.find((w) => isAddressEqual(getAddress(w.address), payer));
      if (!wallet) {
        throw new Error("Embedded Privy wallet not found. Reconnect your wallet and retry.");
      }

      setError(null);
      setResult(null);
      setIsBridging(true);

      try {
        const bridged = await bridgeUsdcToVoiViaX402({
          evmAddress: validation.normalized,
          amount,
          wallet,
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
    [walletAddress, wallets],
  );

  return {
    bridgeUsdc,
    isBridging,
    result,
    error,
  };
}
