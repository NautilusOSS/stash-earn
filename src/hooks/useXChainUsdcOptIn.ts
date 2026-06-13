import { useQueryClient } from "@tanstack/react-query";
import { useSignTypedData } from "@privy-io/react-auth";
import { useCallback, useState } from "react";

import { prepareXChainUsdcOptInFn, submitXChainUsdcOptInFn } from "@/lib/api/xchain.functions";
import type {
  XChainAssetOptInPrepareResult,
  XChainAssetOptInSubmitResult,
} from "@/lib/xchain/types";
import { toPrivyTypedData } from "@/lib/xchain/privy-typed-data";
import { validateEvmAddress } from "@/lib/xchain/validate";

export function useXChainUsdcOptIn(evmAddress: string | undefined) {
  const queryClient = useQueryClient();
  const { signTypedData } = useSignTypedData();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prepareResult, setPrepareResult] = useState<XChainAssetOptInPrepareResult | null>(null);
  const [submitResult, setSubmitResult] = useState<XChainAssetOptInSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optInToUsdc = useCallback(async () => {
    if (!evmAddress) {
      setError("Connect an EVM wallet first");
      return;
    }

    const validation = validateEvmAddress(evmAddress);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setError(null);
    setPrepareResult(null);
    setSubmitResult(null);

    try {
      setIsPreparing(true);
      const prepared = await prepareXChainUsdcOptInFn({
        data: { evmAddress: validation.normalized },
      });
      setPrepareResult(prepared);

      setIsPreparing(false);
      setIsSigning(true);
      const { signature } = await signTypedData(toPrivyTypedData(prepared.typedData), {
        address: validation.normalized,
      });

      setIsSigning(false);
      setIsSubmitting(true);
      const submitted = await submitXChainUsdcOptInFn({
        data: {
          evmAddress: validation.normalized,
          signature,
          unsignedTxnBase64: prepared.unsignedTxnBase64,
        },
      });
      setSubmitResult(submitted);
      await queryClient.invalidateQueries({ queryKey: ["xchain-execution-status"] });
      await queryClient.invalidateQueries({ queryKey: ["wallet-usdc-balance"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "USDC opt-in failed");
    } finally {
      setIsPreparing(false);
      setIsSigning(false);
      setIsSubmitting(false);
    }
  }, [evmAddress, signTypedData, queryClient]);

  return {
    optInToUsdc,
    isPreparing,
    isSigning,
    isSubmitting,
    prepareResult,
    submitResult,
    error,
  };
}
