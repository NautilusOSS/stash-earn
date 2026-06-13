import type { SignTypedDataParams } from "@/lib/xchain/types";
import { useSignTypedData } from "@privy-io/react-auth";
import { useCallback, useState } from "react";

import { prepareXChainSelfPaymentFn, submitXChainSelfPaymentFn } from "@/lib/api/xchain.functions";
import type {
  XChainSelfPaymentPrepareResult,
  XChainSelfPaymentSubmitResult,
} from "@/lib/xchain/types";
import { validateEvmAddress } from "@/lib/xchain/validate";

function toPrivyTypedData(typedData: SignTypedDataParams) {
  return {
    domain: typedData.domain,
    types: {
      EIP712Domain: [...typedData.types.EIP712Domain],
      "Algorand Transaction": [...typedData.types["Algorand Transaction"]],
    },
    primaryType: typedData.primaryType,
    message: typedData.message,
  };
}

export function useXChainSelfPayment(evmAddress: string | undefined) {
  const { signTypedData } = useSignTypedData();
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prepareResult, setPrepareResult] = useState<XChainSelfPaymentPrepareResult | null>(null);
  const [submitResult, setSubmitResult] = useState<XChainSelfPaymentSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sendZeroVoiSelfPayment = useCallback(async () => {
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
      const prepared = await prepareXChainSelfPaymentFn({
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
      const submitted = await submitXChainSelfPaymentFn({
        data: {
          evmAddress: validation.normalized,
          signature,
          unsignedTxnBase64: prepared.unsignedTxnBase64,
        },
      });
      setSubmitResult(submitted);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Self-payment failed");
    } finally {
      setIsPreparing(false);
      setIsSigning(false);
      setIsSubmitting(false);
    }
  }, [evmAddress, signTypedData]);

  return {
    sendZeroVoiSelfPayment,
    isPreparing,
    isSigning,
    isSubmitting,
    prepareResult,
    submitResult,
    error,
  };
}
