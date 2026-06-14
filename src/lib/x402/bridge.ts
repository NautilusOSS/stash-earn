import type { ConnectedWallet } from "@privy-io/react-auth";
import { getAddress, isAddressEqual } from "viem";

import {
  fetchWithX402Payment,
  formatX402ClientError,
  formatX402DollarAmount,
  getX402BridgeUrl,
  parseX402DollarAmount,
  type X402BridgeResponse,
  type X402EvmSigner,
} from "@/lib/x402/client";
import { createPrivyX402Signer } from "@/lib/x402/privy-signer";
import { fetchWalletUsdcBalance } from "@/lib/privy/usdcBalance";
import { validateEvmAddress } from "@/lib/xchain/validate";

export type BridgeUsdcToVoiParams = {
  evmAddress: string;
  amount: number;
  wallet: ConnectedWallet;
  signer?: X402EvmSigner;
};

export type BridgeUsdcToVoiResult = X402BridgeResponse & {
  amount: string;
  bridgeUrl: string;
};

function assertVoiMirrorSucceeded(data: X402BridgeResponse, dollarAmount: string): void {
  if (data.voiUsdc?.txId) return;

  const skipped = data.voiUsdc?.skipped;
  const mirrorError = data.voiUsdc?.error;
  if (skipped) {
    throw new Error(
      `Base USDC payment succeeded but Voi USDC mirror was skipped: ${skipped}`,
    );
  }
  if (mirrorError) {
    throw new Error(`Base USDC payment succeeded but Voi USDC mirror failed: ${mirrorError}`);
  }

  throw new Error(
    `Base USDC payment for ${dollarAmount} succeeded but no Voi USDC transfer was recorded.`,
  );
}

/**
 * Pay USDC on Base via x402; server mirrors the same amount to the payer's Voi execution address.
 */
export async function bridgeUsdcToVoiViaX402(
  params: BridgeUsdcToVoiParams,
): Promise<BridgeUsdcToVoiResult> {
  const validation = validateEvmAddress(params.evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const payer = getAddress(validation.normalized);
  if (!isAddressEqual(getAddress(params.wallet.address), payer)) {
    throw new Error("Embedded Privy wallet does not match the connected address.");
  }

  const dollarAmount = formatX402DollarAmount(params.amount);
  const requiredUsdc = parseX402DollarAmount(dollarAmount);
  const walletUsdc = await fetchWalletUsdcBalance(payer);
  if (walletUsdc < requiredUsdc) {
    throw new Error(
      `Need at least ${dollarAmount} Base USDC in your embedded wallet (have ${walletUsdc.toFixed(2)}).`,
    );
  }

  const signer = params.signer ?? (await createPrivyX402Signer(params.wallet));
  const bridgeUrl = getX402BridgeUrl(dollarAmount);
  const response = await fetchWithX402Payment(bridgeUrl, payer, signer);

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 402 && body.trim() === "{}") {
      throw new Error(
        "Bridge payment was not accepted after signing. The server did not receive a valid payment header.",
      );
    }
    throw new Error(
      formatX402ClientError(new Error(`HTTP ${response.status}`), body, {
        clientUsdcReady: walletUsdc >= requiredUsdc,
      }),
    );
  }

  const data = (await response.json()) as X402BridgeResponse;
  assertVoiMirrorSucceeded(data, dollarAmount);

  return {
    ...data,
    amount: dollarAmount,
    bridgeUrl,
  };
}
