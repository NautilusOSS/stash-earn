import algosdk from "algosdk";

import { submitSignedTransactionGroup } from "@/lib/xchain/transactions.server";
import {
  formatAlgorandAddress,
  loadAlgorandMnemonicAccount,
} from "@/server/x402/algorand-account";

import { getVoiAlgodClient } from "./client.server";
import { getSpendableVoiBalance } from "./execution-account.server";

/** Minimum spendable VOI on an execution address before platform top-up. */
export const MIN_EXECUTION_SPENDABLE_VOI = 1;

/** VOI sent from the platform account when execution spendable balance is below the minimum. */
export const EXECUTION_VOI_TOP_UP_VOI = 1;

function voiToMicroAlgos(voi: number): bigint {
  return BigInt(Math.round(voi * 1_000_000));
}

export async function sendVoiFromPlatform(params: {
  to: string;
  amountMicroAlgos: bigint;
}): Promise<{ txId: string; confirmedRound: number }> {
  const platformAccount = loadAlgorandMnemonicAccount();
  if (!platformAccount) {
    throw new Error("ALGORAND_MNEMONIC is not set.");
  }

  if (params.amountMicroAlgos <= 0n) {
    throw new Error("VOI transfer amount must be positive.");
  }

  const from = formatAlgorandAddress(platformAccount.addr);
  const platformSpendable = await getSpendableVoiBalance(from);
  const sendVoi = Number(params.amountMicroAlgos) / 1_000_000;
  if (platformSpendable + 1e-9 < sendVoi) {
    throw new Error(
      `Platform AVM account has insufficient spendable VOI for top-up (need ${sendVoi}, have ${platformSpendable.toFixed(6)}).`,
    );
  }

  const algod = getVoiAlgodClient();
  const suggestedParams = await algod.getTransactionParams().do();

  const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: from,
    receiver: params.to,
    amount: params.amountMicroAlgos,
    suggestedParams,
  });

  const signed = txn.signTxn(platformAccount.sk);
  return submitSignedTransactionGroup([signed]);
}

export async function ensureExecutionVoiFromPlatform(executionAddress: string): Promise<{
  toppedUp: boolean;
  txId?: string;
  skippedReason?: string;
}> {
  if (!loadAlgorandMnemonicAccount()) {
    return { toppedUp: false, skippedReason: "ALGORAND_MNEMONIC is not configured" };
  }

  const spendable = await getSpendableVoiBalance(executionAddress);
  if (spendable >= MIN_EXECUTION_SPENDABLE_VOI) {
    return { toppedUp: false };
  }

  try {
    const result = await sendVoiFromPlatform({
      to: executionAddress,
      amountMicroAlgos: voiToMicroAlgos(EXECUTION_VOI_TOP_UP_VOI),
    });
    console.info(
      `[voi] Topped up execution ${executionAddress} with ${EXECUTION_VOI_TOP_UP_VOI} VOI: ${result.txId}`,
    );
    return { toppedUp: true, txId: result.txId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "VOI top-up failed";
    console.warn(`[voi] Execution VOI top-up skipped for ${executionAddress}:`, message);
    return { toppedUp: false, skippedReason: message };
  }
}
