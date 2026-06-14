import { isServerDebugMode } from "@/lib/debug.server";
import {
  ensureAvmUsdcOptIn,
  isAvmAccountOptedIntoUsdc,
} from "@/lib/voi/avm-usdc-opt-in.server";
import { getAvmUsdcBalance } from "@/lib/voi/avm-usdc-balance.server";
import { getSpendableVoiBalance } from "@/lib/voi/execution-account.server";
import { VOI_USDC_ASSET_ID } from "@/lib/voi/constants";
import { loadAlgorandMnemonicAccount, formatAlgorandAddress } from "@/server/x402/algorand-account";

export type PlatformAvmUsdcOptInStatus = {
  avmAddress: string;
  assetId: number;
  optedIn: boolean;
  balance: number;
  /** Spendable native VOI (total minus min balance). */
  voiBalance: number;
};

export async function getPlatformAvmUsdcOptInStatus(): Promise<PlatformAvmUsdcOptInStatus | null> {
  const account = loadAlgorandMnemonicAccount();
  if (!account) return null;

  const avmAddress = formatAlgorandAddress(account.addr);
  const [optedIn, balance, voiBalance] = await Promise.all([
    isAvmAccountOptedIntoUsdc(avmAddress),
    getAvmUsdcBalance(avmAddress),
    getSpendableVoiBalance(avmAddress),
  ]);

  return {
    avmAddress,
    assetId: VOI_USDC_ASSET_ID,
    optedIn,
    balance: optedIn ? balance : 0,
    voiBalance,
  };
}

export async function triggerPlatformAvmUsdcOptIn(): Promise<{
  avmAddress: string;
  assetId: number;
  optedIn: boolean;
  txId?: string;
  confirmedRound?: number;
}> {
  if (!isServerDebugMode()) {
    throw new Error("Platform AVM USDC opt-in is only available when VITE_DEBUG=true.");
  }

  const account = loadAlgorandMnemonicAccount();
  if (!account) {
    throw new Error("ALGORAND_MNEMONIC is not set.");
  }

  const avmAddress = formatAlgorandAddress(account.addr);
  const result = await ensureAvmUsdcOptIn(account);
  const optedIn = result ? true : await isAvmAccountOptedIntoUsdc(avmAddress);

  return {
    avmAddress,
    assetId: VOI_USDC_ASSET_ID,
    optedIn,
    txId: result?.txId,
    confirmedRound: result?.confirmedRound,
  };
}
