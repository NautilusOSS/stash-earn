import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { deriveXChainAddresses } from "@/lib/xchain/derive.server";

import {
  depositDorkFiUsdcAuthed,
  depositDorkFiUsdcWithClientAuth,
  getXChainExecutionStatus,
  prepareDorkFiUsdcDeposit,
  prepareDorkFiUsdcDepositSign,
  submitDorkFiUsdcDeposit,
} from "@/lib/dorkfi/deposit.server";
import { getDorkFiUsdcSupplyBalance } from "@/lib/dorkfi/position.server";

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

const accessTokenInput = z.object({
  accessToken: z.string().min(1),
});

const authedEvmInput = accessTokenInput.extend({
  evmAddress: z.string().min(1),
});

const authedDepositInput = authedEvmInput.extend({
  amountAtomic: z.string().min(1).optional(),
});

const clientAuthInput = z.object({
  authorizationSignature: z.string().min(1),
  requestExpiry: z.string().min(1),
});

const depositWithClientAuthInput = authedEvmInput.extend({
  unsignedTxnsBase64: z.array(z.string().min(1)).min(1),
  typedData: z.record(z.string(), z.unknown()),
  rpcPath: z.string().min(1),
  rpcBody: z.record(z.string(), z.unknown()),
  clientAuth: clientAuthInput,
});

/** Supplied USDC in DorkFi aUSDC market for the user's xChain execution address. */
export const getDorkFiUsdcSupplyBalanceFn = createServerFn({ method: "GET" })
  .inputValidator(evmAddressInput)
  .handler(async ({ data }) => {
    const addresses = await deriveXChainAddresses(data.evmAddress);
    const position = await getDorkFiUsdcSupplyBalance(addresses.voiExecutionAddress);
    return {
      ...position,
      voiExecutionAddress: addresses.voiExecutionAddress,
      marketSymbol: "aUSDC",
    };
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

/** Build deposit txns plus Privy RPC path/body for client authorization signing. */
export const prepareDorkFiUsdcDepositSignFn = createServerFn({ method: "POST" })
  .inputValidator(authedDepositInput)
  .handler(async ({ data }) =>
    prepareDorkFiUsdcDepositSign(data.accessToken, data.evmAddress, data.amountAtomic),
  );

/** Server-sign and submit DorkFi USDC supply (no client wallet prompt). */
export const depositDorkFiUsdcAuthedFn = createServerFn({ method: "POST" })
  .inputValidator(authedDepositInput)
  .handler(async ({ data }) =>
    depositDorkFiUsdcAuthed(data.accessToken, data.evmAddress, data.amountAtomic),
  );

/** Client-authorized Privy RPC sign + submit DorkFi USDC supply. */
export const depositDorkFiUsdcWithClientAuthFn = createServerFn({ method: "POST" })
  .inputValidator(depositWithClientAuthInput)
  .handler(async ({ data }) =>
    depositDorkFiUsdcWithClientAuth({
      accessToken: data.accessToken,
      evmAddress: data.evmAddress,
      unsignedTxnsBase64: data.unsignedTxnsBase64,
      typedData: data.typedData as never,
      rpcPath: data.rpcPath,
      rpcBody: data.rpcBody,
      clientAuth: data.clientAuth,
    }),
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
