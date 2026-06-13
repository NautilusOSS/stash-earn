import { useQueryClient } from "@tanstack/react-query";
import { useSignTypedData } from "@privy-io/react-auth";
import { useCallback, useState } from "react";

import {
  prepareDorkFiUsdcDepositFn,
  submitDorkFiUsdcDepositFn,
} from "@/lib/api/dorkfi.functions";
import type {
  DorkFiUsdcDepositPrepareResult,
  DorkFiUsdcDepositSubmitResult,
} from "@/lib/dorkfi/deposit.server";
import { toPrivyTypedData } from "@/lib/xchain/privy-typed-data";
import { validateEvmAddress } from "@/lib/xchain/validate";

export function useDorkfiUsdcDeposit(evmAddress: string | undefined) {
  const queryClient = useQueryClient();
  const { signTypedData } = useSignTypedData();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prepareResult, setPrepareResult] = useState<DorkFiUsdcDepositPrepareResult | null>(null);
  const [submitResult, setSubmitResult] = useState<DorkFiUsdcDepositSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPrepareResult(null);
    setSubmitResult(null);
    setError(null);
  }, []);

  const depositUsdc = useCallback(async () => {
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
      const prepared = await prepareDorkFiUsdcDepositFn({
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
      const submitted = await submitDorkFiUsdcDepositFn({
        data: {
          evmAddress: validation.normalized,
          signature,
          unsignedTxnsBase64: prepared.unsignedTxnsBase64,
        },
      });
      setSubmitResult(submitted);
      await queryClient.invalidateQueries({ queryKey: ["xchain-execution-status"] });
      await queryClient.invalidateQueries({ queryKey: ["wallet-usdc-balance"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "DorkFi deposit failed");
    } finally {
      setIsPreparing(false);
      setIsSigning(false);
      setIsSubmitting(false);
    }
  }, [evmAddress, signTypedData, queryClient]);

  return {
    depositUsdc,
    isPreparing,
    isSigning,
    isSubmitting,
    prepareResult,
    submitResult,
    error,
    reset,
  };
}
