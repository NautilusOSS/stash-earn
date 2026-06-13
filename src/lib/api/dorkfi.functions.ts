import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getXChainExecutionStatus,
  prepareDorkFiUsdcDeposit,
  submitDorkFiUsdcDeposit,
} from "@/lib/dorkfi/deposit.server";

const evmAddressInput = z.object({
  evmAddress: z.string().min(1),
});

const prepareDepositInput = z.object({
  evmAddress: z.string().min(1),
  /** USDC base units (micro-USDC), same as lendingService.deposit `amount`. */
  amountAtomic: z.string().min(1).optional(),
});

const submitDepositInput = z.object({
  evmAddress: z.string().min(1),
  signature: z.string().min(1),
  unsignedTxnsBase64: z.array(z.string().min(1)).min(1),
});

/** Execution address balances, USDC opt-in, and funding guidance for DorkFi deposit. */
export const getXChainExecutionStatusFn = createServerFn({ method: "GET" })
  .inputValidator(evmAddressInput)
  .handler(async ({ data }) => getXChainExecutionStatus(data.evmAddress));

/** Build unsigned DorkFi USDC supply txn group + EIP-712 typed data. */
export const prepareDorkFiUsdcDepositFn = createServerFn({ method: "POST" })
  .inputValidator(prepareDepositInput)
  .handler(async ({ data }) =>
    prepareDorkFiUsdcDeposit(data.evmAddress, data.amountAtomic),
  );

/** Attach EVM signature and submit DorkFi USDC supply to Voi mainnet. */
export const submitDorkFiUsdcDepositFn = createServerFn({ method: "POST" })
  .inputValidator(submitDepositInput)
  .handler(async ({ data }) =>
    submitDorkFiUsdcDeposit({
      evmAddress: data.evmAddress,
      signature: data.signature,
      unsignedTxnsBase64: data.unsignedTxnsBase64,
    }),
  );
