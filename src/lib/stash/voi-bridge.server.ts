import type { Address } from "viem";

import { pollWalletAction, walletActionFailureMessage } from "@/lib/privy/earn.server";
import type { WalletAction } from "@/lib/privy/earn.types";
import { mapWalletAction, transferUsdcOnBase } from "@/lib/privy/transfer.server";
import { buildUsdcTransferBody } from "@/lib/privy/transfer-body";
import type { PrivyAuthorizationContext } from "@/lib/privy/privy-api.server";
import { resolveEmbeddedWalletId, verifyPrivyAccessToken } from "@/lib/privy/session.server";
import type { PrivyWalletActionAuth } from "@/lib/privy/wallet-action-auth";
import { distributeVoiUsdcToPayer } from "@/server/x402/distribute-voi-usdc.server";
import type { VoiUsdcDistributionResult } from "@/server/x402/distribute-voi-usdc.server";
import { getX402Config } from "@/server/x402/config";
import { loadAlgorandMnemonicAccount } from "@/server/x402/algorand-account";

export type VoiBridgeTransferResult = {
  transferAction: WalletAction;
  voiUsdc: VoiUsdcDistributionResult;
};

function getBridgeReceiverAddress(): Address {
  const receiver = getX402Config().evm.receiverAddress;
  if (!receiver) {
    throw new Error("EVM_RECEIVER_ADDRESS is not configured for Voi bridging.");
  }
  return receiver;
}

/** Privy wallet transfer + platform Voi USDC mirror (ALGORAND_MNEMONIC). */
export function isVoiBridgeConfigured(): boolean {
  return Boolean(getX402Config().evm.receiverAddress && loadAlgorandMnemonicAccount());
}

export async function prepareVoiBridgeTransfer(
  accessToken: string,
  evmAddress: string,
  rawAmount: string,
): Promise<{ path: string; body: Record<string, unknown> }> {
  if (!isVoiBridgeConfigured()) {
    throw new Error("Voi bridge is not configured on the server.");
  }

  const amount = BigInt(rawAmount);
  if (amount <= 0n) {
    throw new Error("Bridge amount must be greater than zero.");
  }

  const { userId } = await verifyPrivyAccessToken(accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, evmAddress);
  const receiver = getBridgeReceiverAddress();

  return {
    path: `/wallets/${encodeURIComponent(walletId)}/transfer`,
    body: buildUsdcTransferBody(receiver, amount),
  };
}

export async function executeVoiBridgeTransfer(
  accessToken: string,
  evmAddress: string,
  rawAmount: string,
  clientAuth?: PrivyWalletActionAuth,
  signedBody?: Record<string, unknown>,
): Promise<VoiBridgeTransferResult> {
  if (!isVoiBridgeConfigured()) {
    throw new Error("Voi bridge is not configured on the server.");
  }

  const amount = BigInt(rawAmount);
  if (amount <= 0n) {
    throw new Error("Bridge amount must be greater than zero.");
  }

  const receiver = getBridgeReceiverAddress();
  const authCtx: PrivyAuthorizationContext = {};

  const { action } = await transferUsdcOnBase(
    accessToken,
    evmAddress,
    receiver,
    rawAmount,
    authCtx,
    clientAuth,
    signedBody,
  );

  const completed = await pollWalletAction(action.walletId, action.id);
  const status = completed.status as string;
  if (status === "failed" || status === "rejected") {
    throw new Error(
      walletActionFailureMessage(completed, "Base USDC transfer for Voi bridge failed."),
    );
  }

  const voiUsdc = await distributeVoiUsdcToPayer({
    payerEvmAddress: evmAddress,
    amountAtomic: rawAmount,
  });

  if (!voiUsdc.txId) {
    const detail = voiUsdc.error ?? voiUsdc.skippedReason ?? "Voi USDC mirror failed";
    throw new Error(`Base transfer succeeded but Voi mirror failed: ${detail}`);
  }

  return {
    transferAction: mapWalletAction(completed),
    voiUsdc,
  };
}
