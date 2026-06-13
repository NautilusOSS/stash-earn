import algosdk from "algosdk";

import { deriveXChainAddresses } from "@/lib/xchain/derive.server";
import {
  buildXChainTypedDataForTxns,
  signAndSubmitVoiXChainTransactionGroup,
} from "@/lib/xchain/transactions.server";
import type {
  XChainSelfPaymentPrepareResult,
  XChainSelfPaymentSubmitResult,
} from "@/lib/xchain/types";
import { validateEvmAddress } from "@/lib/xchain/validate";
import { VOI_NETWORK } from "@/lib/voi/constants";
import { getVoiAlgodClient } from "@/lib/voi/client.server";

export async function prepareXChainSelfPayment(
  evmAddress: string,
): Promise<XChainSelfPaymentPrepareResult> {
  const validation = validateEvmAddress(evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const addresses = await deriveXChainAddresses(validation.normalized);
  const algod = getVoiAlgodClient();
  const suggestedParams = await algod.getTransactionParams().do();

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: addresses.voiExecutionAddress,
    receiver: addresses.voiExecutionAddress,
    amount: 0,
    suggestedParams,
  });

  const unsignedTxnBase64 = Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64");
  const typedData = buildXChainTypedDataForTxns([txn]);

  return {
    unsignedTxnBase64,
    typedData,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: addresses.voiExecutionAddress,
    network: VOI_NETWORK,
  };
}

export async function submitXChainSelfPayment(params: {
  evmAddress: string;
  signature: string;
  unsignedTxnBase64: string;
}): Promise<XChainSelfPaymentSubmitResult> {
  const validation = validateEvmAddress(params.evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const addresses = await deriveXChainAddresses(validation.normalized);

  let result: { txId: string; confirmedRound: number };
  try {
    result = await signAndSubmitVoiXChainTransactionGroup({
      evmAddress: validation.normalized,
      unsignedTxnBase64: params.unsignedTxnBase64,
      signature: params.signature,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown signing error";
    if (/signature|recover|mismatch|invalid/i.test(message)) {
      throw new Error(
        `EVM signature mismatch — sign with the same wallet that derived this xChain address (${validation.normalized}). ${message}`,
      );
    }
    throw error instanceof Error ? error : new Error(message);
  }

  return {
    txId: result.txId,
    confirmedRound: result.confirmedRound,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: addresses.voiExecutionAddress,
  };
}
