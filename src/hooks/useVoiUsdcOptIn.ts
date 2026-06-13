import type { SignTypedDataParams } from "@/lib/xchain/types";
import { useSignTypedData } from "@privy-io/react-auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";

import {
  getVoiUsdcOptInStatusFn,
  prepareXChainUsdcOptInFn,
  submitXChainUsdcOptInFn,
} from "@/lib/api/xchain.functions";
import type { VoiUsdcOptInStatus, XChainAssetOptInSubmitResult } from "@/lib/xchain/types";
import { validateEvmAddress } from "@/lib/xchain/validate";
import { VOI_USDC_ASSET_ID } from "@/lib/voi/constants";

export const voiUsdcOptInQueryKey = (address: string | undefined) =>
  ["voi-usdc-opt-in", address] as const;

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

export function useVoiUsdcOptIn(evmAddress: string | undefined) {
  const { signTypedData } = useSignTypedData();
  const queryClient = useQueryClient();
  const validation = evmAddress ? validateEvmAddress(evmAddress) : null;

  const statusQuery = useQuery({
    queryKey: voiUsdcOptInQueryKey(validation?.valid ? validation.normalized : undefined),
    queryFn: () => getVoiUsdcOptInStatusFn({ data: { evmAddress: validation!.normalized } }),
    enabled: validation?.valid === true,
    staleTime: 30_000,
  });

  const [isPreparing, setIsPreparing] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<XChainAssetOptInSubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const optIn = useCallback(async () => {
    if (!evmAddress) {
      setError("Connect an EVM wallet first");
      return;
    }

    if (!validation?.valid) {
      setError(validation?.error ?? "Invalid EVM address");
      return;
    }

    if (statusQuery.data?.optedIn) {
      setError("Already opted into USDC on Voi");
      return;
    }

    setError(null);
    setSubmitResult(null);

    try {
      setIsPreparing(true);
      const prepared = await prepareXChainUsdcOptInFn({
        data: { evmAddress: validation.normalized },
      });

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
      await queryClient.invalidateQueries({ queryKey: ["voi-usdc-opt-in"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "USDC opt-in failed");
    } finally {
      setIsPreparing(false);
      setIsSigning(false);
      setIsSubmitting(false);
    }
  }, [evmAddress, validation, signTypedData, statusQuery.data?.optedIn, queryClient]);

  const isBusy = isPreparing || isSigning || isSubmitting;

  return {
    assetId: VOI_USDC_ASSET_ID,
    status: statusQuery.data as VoiUsdcOptInStatus | undefined,
    isLoadingStatus: statusQuery.isLoading,
    statusError: validation && !validation.valid ? validation.error : statusQuery.error?.message,
    optedIn: statusQuery.data?.optedIn ?? false,
    optIn,
    isBusy,
    isPreparing,
    isSigning,
    isSubmitting,
    submitResult,
    error,
    refetchStatus: statusQuery.refetch,
  };
}
