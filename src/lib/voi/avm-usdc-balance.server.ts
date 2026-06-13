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

/** USDC balance on a Voi AVM account (ASA 302190). Returns 0 if not opted in. */
export async function getAvmUsdcBalance(avmAddress: string): Promise<number> {
  const algod = getVoiAlgodClient();
  try {
    const info = await algod.accountAssetInformation(avmAddress, VOI_USDC_ASSET_ID).do();
    return Number(formatUnits(readAssetHoldingAmount(info), VOI_USDC_DECIMALS));
  } catch {
    return 0;
  }
}
