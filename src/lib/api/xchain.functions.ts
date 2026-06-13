import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { deriveXChainAddresses } from "@/lib/xchain/derive.server";
import {
  prepareXChainSelfPayment,
  submitXChainSelfPayment,
} from "@/lib/xchain/self-payment.server";

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
