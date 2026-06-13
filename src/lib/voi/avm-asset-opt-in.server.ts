import { getVoiAlgodClient } from "./client.server";

export async function isAvmAccountOptedIntoAsset(
  avmAddress: string,
  assetId: number,
): Promise<boolean> {
  const algod = getVoiAlgodClient();
  try {
    await algod.accountAssetInformation(avmAddress, assetId).do();
    return true;
  } catch {
    return false;
  }
}
