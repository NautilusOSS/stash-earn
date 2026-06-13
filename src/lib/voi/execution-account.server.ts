import { formatUnits } from "viem";

import { getVoiAlgodClient } from "./client.server";
import { VOI_USDC_ASSET_ID } from "./constants";
import { getAvmUsdcBalance } from "./avm-usdc-balance.server";
import { isAvmAccountOptedIntoAsset } from "./avm-asset-opt-in.server";

type AccountInfo = {
  amount?: number | string;
  minBalance?: number | string;
};

function readMicroAlgos(info: AccountInfo): { balance: bigint; minBalance: bigint } {
  const balance = BigInt(info.amount ?? 0);
  const minBalance = BigInt(info.minBalance ?? 0);
  return { balance, minBalance };
}

export async function getSpendableVoiBalance(avmAddress: string): Promise<number> {
  const algod = getVoiAlgodClient();
  const info = await algod.accountInformation(avmAddress).do();
  const { balance, minBalance } = readMicroAlgos(info);
  const spendable = balance > minBalance ? balance - minBalance : 0n;
  return Number(formatUnits(spendable, 6));
}

export async function getExecutionAddressBalances(params: {
  executionAddress: string;
  usdcAssetId?: number;
  nTokenAssetId?: number;
}): Promise<{
  spendableVoi: number;
  usdcBalance: number;
  usdcOptedIn: boolean;
  nTokenOptedIn: boolean;
}> {
  const usdcAssetId = params.usdcAssetId ?? VOI_USDC_ASSET_ID;
  const [spendableVoi, usdcBalance, usdcOptedIn, nTokenOptedIn] = await Promise.all([
    getSpendableVoiBalance(params.executionAddress),
    getAvmUsdcBalance(params.executionAddress),
    isAvmAccountOptedIntoAsset(params.executionAddress, usdcAssetId),
    params.nTokenAssetId != null
      ? isAvmAccountOptedIntoAsset(params.executionAddress, params.nTokenAssetId)
      : Promise.resolve(false),
  ]);

  return {
    spendableVoi,
    usdcBalance,
    usdcOptedIn,
    nTokenOptedIn,
  };
}
