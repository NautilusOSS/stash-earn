import algosdk from "algosdk";

import { submitSignedTransactionGroup } from "@/lib/xchain/transactions.server";
import { formatAlgorandAddress } from "@/server/x402/algorand-account";

import { getVoiAlgodClient } from "./client.server";
import { VOI_USDC_ASSET_ID } from "./constants";

export async function isAvmAccountOptedIntoUsdc(avmAddress: string): Promise<boolean> {
  const algod = getVoiAlgodClient();
  try {
    await algod.accountAssetInformation(avmAddress, VOI_USDC_ASSET_ID).do();
    return true;
  } catch {
    return false;
  }
}

export async function buildAvmUsdcOptInTransaction(sender: string): Promise<algosdk.Transaction> {
  const algod = getVoiAlgodClient();
  const suggestedParams = await algod.getTransactionParams().do();
  return algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
    sender,
    receiver: sender,
    amount: 0,
    assetIndex: VOI_USDC_ASSET_ID,
    suggestedParams,
  });
}

/** Opt in a native Voi AVM account to USDC (ASA 302190). Returns submission result when opted in now. */
export async function ensureAvmUsdcOptIn(account: algosdk.Account): Promise<{
  txId: string;
  confirmedRound: number;
} | null> {
  const avmAddress = formatAlgorandAddress(account.addr);

  if (await isAvmAccountOptedIntoUsdc(avmAddress)) {
    console.info(
      `[platform] AVM account ${avmAddress} already opted into USDC (${VOI_USDC_ASSET_ID})`,
    );
    return null;
  }

  const txn = await buildAvmUsdcOptInTransaction(avmAddress);
  const signed = txn.signTxn(account.sk);
  const result = await submitSignedTransactionGroup([signed]);
  console.info(
    `[platform] AVM USDC opt-in confirmed for ${avmAddress}: ${result.txId} (round ${result.confirmedRound})`,
  );
  return result;
}
