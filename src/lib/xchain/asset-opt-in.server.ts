import algosdk from "algosdk";

import { deriveXChainAddresses } from "@/lib/xchain/derive.server";
import {
  buildXChainTypedDataForTxns,
  signAndSubmitVoiXChainTransactionGroup,
} from "@/lib/xchain/transactions.server";
import type {
  VoiUsdcOptInStatus,
  XChainAssetOptInPrepareResult,
  XChainAssetOptInSubmitResult,
} from "@/lib/xchain/types";
import { validateEvmAddress } from "@/lib/xchain/validate";
import {
  buildAvmUsdcOptInTransaction,
  isAvmAccountOptedIntoUsdc,
} from "@/lib/voi/avm-usdc-opt-in.server";
import { VOI_NETWORK, VOI_USDC_ASSET_ID } from "@/lib/voi/constants";

export async function getVoiUsdcOptInStatus(evmAddress: string): Promise<VoiUsdcOptInStatus> {
  const validation = validateEvmAddress(evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const addresses = await deriveXChainAddresses(validation.normalized);
  const optedIn = await isAvmAccountOptedIntoUsdc(addresses.voiExecutionAddress);

  return {
    assetId: VOI_USDC_ASSET_ID,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: addresses.voiExecutionAddress,
    optedIn,
  };
}

export async function prepareXChainUsdcOptIn(
  evmAddress: string,
): Promise<XChainAssetOptInPrepareResult> {
  const validation = validateEvmAddress(evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const addresses = await deriveXChainAddresses(validation.normalized);

  if (await isAvmAccountOptedIntoUsdc(addresses.voiExecutionAddress)) {
    throw new Error("Execution address is already opted into USDC on Voi.");
  }

  const txn = await buildAvmUsdcOptInTransaction(addresses.voiExecutionAddress);

  const unsignedTxnBase64 = Buffer.from(algosdk.encodeUnsignedTransaction(txn)).toString("base64");
  const typedData = buildXChainTypedDataForTxns([txn]);

  return {
    unsignedTxnBase64,
    typedData,
    assetId: VOI_USDC_ASSET_ID,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: addresses.voiExecutionAddress,
    network: VOI_NETWORK,
  };
}

export async function submitXChainUsdcOptIn(params: {
  evmAddress: string;
  signature: string;
  unsignedTxnBase64: string;
}): Promise<XChainAssetOptInSubmitResult> {
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
    assetId: VOI_USDC_ASSET_ID,
    voiAddress: addresses.voiAddress,
    voiExecutionAddress: addresses.voiExecutionAddress,
  };
}
