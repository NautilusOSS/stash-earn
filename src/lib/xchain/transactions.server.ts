import algosdk from "algosdk";

import { buildTypedData, parseEvmSignature, type SignTypedDataParams } from "@/lib/xchain/sdk.server";

import { getExecutionCompiledProgram } from "@/lib/xchain/derive.server";
import { validateEvmAddress } from "@/lib/xchain/validate";
import { getVoiAlgodClient } from "@/lib/voi/client.server";

const CONFIRMATION_WAIT_ROUNDS = 4;

function getXChainSignPayload(txnGroup: algosdk.Transaction[]): Uint8Array {
  if (txnGroup.length === 0) {
    throw new Error("Cannot get sign payload from empty transaction group");
  }
  return txnGroup.length > 1 ? txnGroup[0].group! : txnGroup[0].rawTxID();
}

export function decodeUnsignedTransactionGroup(
  unsignedTxnBase64: string | string[],
): algosdk.Transaction[] {
  const encoded = Array.isArray(unsignedTxnBase64) ? unsignedTxnBase64 : [unsignedTxnBase64];
  return encoded.map((base64) => algosdk.decodeUnsignedTransaction(Buffer.from(base64, "base64")));
}

export function buildXChainTypedDataForTxns(txns: algosdk.Transaction[]): SignTypedDataParams {
  return buildTypedData(getXChainSignPayload(txns));
}

export async function signVoiXChainTransactionGroup(params: {
  evmAddress: string;
  unsignedTxnBase64: string | string[];
  signature: string;
}): Promise<Uint8Array[]> {
  const validation = validateEvmAddress(params.evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const txns = decodeUnsignedTransactionGroup(params.unsignedTxnBase64);
  const compiled = await getExecutionCompiledProgram(validation.normalized);
  const sigBytes = parseEvmSignature(params.signature);
  const lsig = new algosdk.LogicSigAccount(compiled, [sigBytes]);

  return txns.map((txn) => algosdk.signLogicSigTransactionObject(txn, lsig).blob);
}

export async function submitSignedTransactionGroup(signedBlobs: Uint8Array[]): Promise<{
  txId: string;
  confirmedRound: number;
}> {
  if (signedBlobs.length === 0) {
    throw new Error("No signed transactions to submit");
  }

  const algod = getVoiAlgodClient();
  const concatenated = Buffer.concat(signedBlobs.map((blob) => Buffer.from(blob)));

  let txId: string;
  try {
    const response = await algod.sendRawTransaction(concatenated).do();
    txId = response.txid;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown submission error";
    if (/balance|underflow|insufficient/i.test(message)) {
      throw new Error(
        "Insufficient balance on the execution address. Fund the AVM v10 execution address with VOI before submitting.",
      );
    }
    throw new Error(`Failed to submit transaction to Voi algod: ${message}`);
  }

  try {
    const confirmation = await algosdk.waitForConfirmation(algod, txId, CONFIRMATION_WAIT_ROUNDS);
    return {
      txId,
      confirmedRound: confirmation["confirmed-round"],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown confirmation error";
    throw new Error(`Transaction submitted (${txId}) but confirmation failed: ${message}`);
  }
}

export async function signAndSubmitVoiXChainTransactionGroup(params: {
  evmAddress: string;
  unsignedTxnBase64: string | string[];
  signature: string;
}): Promise<{ txId: string; confirmedRound: number }> {
  const signedBlobs = await signVoiXChainTransactionGroup(params);
  return submitSignedTransactionGroup(signedBlobs);
}
