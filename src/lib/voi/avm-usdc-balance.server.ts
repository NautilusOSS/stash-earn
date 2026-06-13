import { formatUnits } from "viem";

import { getVoiAlgodClient } from "./client.server";
import { VOI_USDC_ASSET_ID, VOI_USDC_DECIMALS } from "./constants";

type AccountAssetInfo = {
  amount?: number | string;
  assetHolding?: {
    amount?: number | string;
  };
};

/** algosdk v3 nests holding under `assetHolding`; v2 used top-level `amount`. */
function readAssetHoldingAmount(info: AccountAssetInfo): bigint {
  const raw = info.assetHolding?.amount ?? info.amount;
  if (raw === undefined) return 0n;
  return BigInt(raw);
}

export type AvmUsdcHolding = {
  balance: number;
  /** Exact human-readable amount for display (from on-chain atomic units). */
  amount: string;
  /** USDC base units (micro-USDC) for lending deposit calls. */
  amountAtomic: string;
};

/** USDC holding on ASA 302190. Returns null if not opted in. */
export async function getAvmUsdcHolding(avmAddress: string): Promise<AvmUsdcHolding | null> {
  const algod = getVoiAlgodClient();
  try {
    const info = await algod.accountAssetInformation(avmAddress, VOI_USDC_ASSET_ID).do();
    const atomic = readAssetHoldingAmount(info);
    const amount = formatUnits(atomic, VOI_USDC_DECIMALS);
    return {
      balance: Number(amount),
      amount,
      amountAtomic: atomic.toString(),
    };
  } catch {
    return null;
  }
}

/** USDC balance on a Voi AVM account (ASA 302190). Returns 0 if not opted in. */
export async function getAvmUsdcBalance(avmAddress: string): Promise<number> {
  const holding = await getAvmUsdcHolding(avmAddress);
  return holding?.balance ?? 0;
}
