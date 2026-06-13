import algosdk from "algosdk";

import { submitSignedTransactionGroup } from "@/lib/xchain/transactions.server";
import {
  formatAlgorandAddress,
  loadAlgorandMnemonicAccount,
} from "@/server/x402/algorand-account";

import { getVoiAlgodClient } from "./client.server";
import { VOI_USDC_ASSET_ID } from "./constants";
import { isAvmAccountOptedIntoUsdc } from "./avm-usdc-opt-in.server";

export async function sendAvmUsdcFromPlatform(params: {
  to: string;
  amount: bigint;
}): Promise<{ txId: string; confirmedRound: number }> {
  const platformAccount = loadAlgorandMnemonicAccount();
  if (!platformAccount) {
    throw new Error("ALGORAND_MNEMONIC is not set.");
  }

  if (params.amount <= 0n) {
    throw new Error("USDC transfer amount must be positive.");
  }

  const from = formatAlgorandAddress(platformAccount.addr);

  if (!await isAvmAccountOptedIntoUsdc(from)) {
    throw new Error(`Platform AVM account ${from} is not opted into USDC (${VOI_USDC_ASSET_ID}).`);
  }

  if (!await isAvmAccountOptedIntoUsdc(params.to)) {
    throw new Error(
      `Recipient ${params.to} is not opted into USDC (${VOI_USDC_ASSET_ID}). User must opt in first.`,
    );
  }

  const algod = getVoiAlgodClient();
  const suggestedParams = await algod.getTransactionParams().do();

  const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender: from,
    receiver: params.to,
    amount: params.amount,
    assetIndex: VOI_USDC_ASSET_ID,
    suggestedParams,
  });

  const signed = txn.signTxn(platformAccount.sk);
  return submitSignedTransactionGroup([signed]);
}
