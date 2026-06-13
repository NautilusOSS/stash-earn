import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { deriveXChainAddresses } from "@/lib/xchain/derive.server";
import {
  getVoiUsdcOptInStatus,
  prepareXChainUsdcOptIn,
  submitXChainUsdcOptIn,
} from "@/lib/xchain/asset-opt-in.server";
import {
  prepareXChainSelfPayment,
  submitXChainSelfPayment,
} from "@/lib/xchain/self-payment.server";
import { getAvmUsdcBalance } from "@/lib/voi/avm-usdc-balance.server";

const evmAddressInput = z.object({
  evmAddress: z.string().min(1),
});

const submitSelfPaymentInput = z.object({
  evmAddress: z.string().min(1),
  signature: z.string().min(1),
  unsignedTxnBase64: z.string().min(1),
});

/** Derive canonical (AVM v11) and execution (AVM v10) Voi xChain addresses for an EVM owner. */
export const getXChainAddress = createServerFn({ method: "GET" })
  .inputValidator(evmAddressInput)
  .handler(async ({ data }) => deriveXChainAddresses(data.evmAddress));

/** USDC balance on the payer's Voi xChain execution address (ASA 302190). */
export const getXChainExecutionUsdcBalance = createServerFn({ method: "GET" })
  .inputValidator(evmAddressInput)
  .handler(async ({ data }) => {
    const addresses = await deriveXChainAddresses(data.evmAddress);
    const balance = await getAvmUsdcBalance(addresses.voiExecutionAddress);
    return {
      voiExecutionAddress: addresses.voiExecutionAddress,
      balance,
    };
  });

/** Whether the execution address has opted into Voi mainnet USDC (ASA 302190). */
export const getVoiUsdcOptInStatusFn = createServerFn({ method: "GET" })
  .inputValidator(evmAddressInput)
  .handler(async ({ data }) => getVoiUsdcOptInStatus(data.evmAddress));

/** Build a USDC ASA opt-in txn and EIP-712 typed data for EVM signing. */
export const prepareXChainUsdcOptInFn = createServerFn({ method: "POST" })
  .inputValidator(evmAddressInput)
  .handler(async ({ data }) => prepareXChainUsdcOptIn(data.evmAddress));

/** Attach an EVM EIP-712 signature and submit the USDC opt-in to Voi mainnet. */
export const submitXChainUsdcOptInFn = createServerFn({ method: "POST" })
  .inputValidator(submitSelfPaymentInput)
  .handler(async ({ data }) =>
    submitXChainUsdcOptIn({
      evmAddress: data.evmAddress,
      signature: data.signature,
      unsignedTxnBase64: data.unsignedTxnBase64,
    }),
  );

/** Build a 0 VOI self-payment txn and EIP-712 typed data for EVM signing. */
export const prepareXChainSelfPaymentFn = createServerFn({ method: "POST" })
  .inputValidator(evmAddressInput)
  .handler(async ({ data }) => prepareXChainSelfPayment(data.evmAddress));

/** Attach an EVM EIP-712 signature and submit the self-payment to Voi mainnet. */
export const submitXChainSelfPaymentFn = createServerFn({ method: "POST" })
  .inputValidator(submitSelfPaymentInput)
  .handler(async ({ data }) =>
    submitXChainSelfPayment({
      evmAddress: data.evmAddress,
      signature: data.signature,
      unsignedTxnBase64: data.unsignedTxnBase64,
    }),
  );
