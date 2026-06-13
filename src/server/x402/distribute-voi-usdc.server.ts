import { deriveXChainAddresses } from "@/lib/xchain/derive.server";
import { validateEvmAddress } from "@/lib/xchain/validate";
import { isAvmAccountOptedIntoUsdc } from "@/lib/voi/avm-usdc-opt-in.server";
import { sendAvmUsdcFromPlatform } from "@/lib/voi/avm-usdc-transfer.server";
import { VOI_USDC_ASSET_ID } from "@/lib/voi/constants";
import { loadAlgorandMnemonicAccount } from "@/server/x402/algorand-account";

export type VoiUsdcDistributionResult = {
  attempted: boolean;
  skippedReason?: string;
  recipientAddress?: string;
  amountAtomic?: string;
  txId?: string;
  confirmedRound?: number;
  error?: string;
};

/**
 * After Base x402 settlement, send matching USDC on Voi from the platform AVM account
 * (ALGORAND_MNEMONIC) to the payer's xChain execution Algorand address.
 */
export async function distributeVoiUsdcToPayer(params: {
  payerEvmAddress: string;
  amountAtomic: string;
}): Promise<VoiUsdcDistributionResult> {
  if (!loadAlgorandMnemonicAccount()) {
    return { attempted: false, skippedReason: "ALGORAND_MNEMONIC is not configured" };
  }

  const validation = validateEvmAddress(params.payerEvmAddress);
  if (!validation.valid) {
    return { attempted: false, skippedReason: validation.error };
  }

  let amount: bigint;
  try {
    amount = BigInt(params.amountAtomic);
  } catch {
    return { attempted: false, skippedReason: "Invalid USDC amount" };
  }

  if (amount <= 0n) {
    return { attempted: false, skippedReason: "USDC amount must be positive" };
  }

  const addresses = await deriveXChainAddresses(validation.normalized);
  const recipientAddress = addresses.voiExecutionAddress;

  if (!await isAvmAccountOptedIntoUsdc(recipientAddress)) {
    return {
      attempted: false,
      skippedReason: `Payer Algorand account is not opted into USDC (ASA ${VOI_USDC_ASSET_ID})`,
      recipientAddress,
      amountAtomic: params.amountAtomic,
    };
  }

  try {
    const result = await sendAvmUsdcFromPlatform({ to: recipientAddress, amount });
    console.info(
      `[x402] Voi USDC sent to ${recipientAddress}: ${params.amountAtomic} micro units, tx ${result.txId}`,
    );
    return {
      attempted: true,
      recipientAddress,
      amountAtomic: params.amountAtomic,
      txId: result.txId,
      confirmedRound: result.confirmedRound,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Voi USDC transfer failed";
    console.error(`[x402] Voi USDC distribution failed for ${recipientAddress}:`, message);
    return {
      attempted: true,
      recipientAddress,
      amountAtomic: params.amountAtomic,
      error: message,
    };
  }
}
