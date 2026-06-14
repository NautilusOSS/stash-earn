import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  depositToEarnVault,
  getEarnAction,
  getEarnPositionForUser,
  getEarnVaultDetails,
  isEarnConfigured,
  pollEarnAction,
  prepareEarnDeposit,
} from "@/lib/privy/earn.server";
import type { PrivyAuthorizationContext } from "@/lib/privy/privy-api.server";
import { requireUserWithdrawAddress } from "@/lib/privy/metadata.server";
import {
  executeStashWithdraw,
  prepareStashWithdraw,
} from "@/lib/privy/stash-withdraw.server";
import type { StashWithdrawSignedAction } from "@/lib/privy/stash-withdraw.types";

const accessTokenInput = z.object({
  accessToken: z.string().min(1),
});

const positionInput = accessTokenInput.extend({
  evmAddress: z.string().min(1),
});

const amountInput = positionInput.extend({
  rawAmount: z.string().regex(/^\d+$/),
});

const walletActionAuthSchema = z.object({
  authorizationSignature: z.string().min(1),
  requestExpiry: z.string().min(1),
});

const signedActionSchema = z.object({
  id: z.enum(["transfer-wallet", "vault-withdraw", "transfer-vault"]),
  path: z.string().min(1),
  body: z.record(z.unknown()),
  authorizationSignature: z.string().min(1),
  requestExpiry: z.string().min(1),
});

const withdrawInput = amountInput.extend({
  signedActions: z.array(signedActionSchema).optional(),
});

const depositInput = amountInput.extend({
  clientAuth: walletActionAuthSchema.optional(),
  signedBody: z.record(z.unknown()).optional(),
});

const actionInput = z.object({
  actionId: z.string().min(1),
  walletId: z.string().min(1),
});

/** Whether Privy Earn vault ID is configured on the server. */
export const getEarnConfiguredFn = createServerFn({ method: "GET" }).handler(async () => ({
  configured: isEarnConfigured(),
}));

/** Vault APY, liquidity, and metadata from Privy Earn. */
export const getEarnVaultDetailsFn = createServerFn({ method: "GET" }).handler(async () => {
  const configured = isEarnConfigured();
  if (!configured) {
    return { details: null, configured: false, detailsError: null };
  }

  try {
    const details = await getEarnVaultDetails();
    return { details, configured: true, detailsError: null };
  } catch (error) {
    const detailsError =
      error instanceof Error ? error.message : "Failed to load vault details";
    return { details: null, configured: true, detailsError };
  }
});

/** Wallet position in the configured earn vault. */
export const getEarnPositionFn = createServerFn({ method: "GET" })
  .inputValidator(positionInput)
  .handler(async ({ data }) => {
    const position = await getEarnPositionForUser(data.accessToken, data.evmAddress);
    return { position, configured: isEarnConfigured() };
  });

/** Wallet API payload to sign before depositing into the earn vault. */
export const prepareEarnDepositFn = createServerFn({ method: "POST" })
  .inputValidator(amountInput)
  .handler(async ({ data }) => {
    return prepareEarnDeposit(data.accessToken, data.evmAddress, data.rawAmount);
  });

/** Deposit Base USDC into the Privy Earn vault. */
export const earnDepositFn = createServerFn({ method: "POST" })
  .inputValidator(depositInput)
  .handler(async ({ data }) => {
    const authCtx: PrivyAuthorizationContext = {};
    const result = await depositToEarnVault(
      data.accessToken,
      data.evmAddress,
      data.rawAmount,
      authCtx,
      data.clientAuth,
      data.signedBody,
    );
    const action = await pollEarnAction(result.action.walletId, result.action.id);
    return { action };
  });

/** Wallet API payloads to sign before withdrawing. */
export const prepareEarnWithdrawFn = createServerFn({ method: "POST" })
  .inputValidator(amountInput)
  .handler(async ({ data }) => {
    const destinationAddress = await requireUserWithdrawAddress(data.accessToken);
    return prepareStashWithdraw(
      data.accessToken,
      data.evmAddress,
      data.rawAmount,
      destinationAddress,
    );
  });

/** Withdraw USDC to the user's Base address (wallet → vault → Voi priority). */
export const earnWithdrawFn = createServerFn({ method: "POST" })
  .inputValidator(withdrawInput)
  .handler(async ({ data }) => {
    const destinationAddress = await requireUserWithdrawAddress(data.accessToken);
    return executeStashWithdraw(
      data.accessToken,
      data.evmAddress,
      data.rawAmount,
      destinationAddress,
      data.signedActions as StashWithdrawSignedAction[] | undefined,
    );
  });

/** Poll a single earn wallet action by ID. */
export const getEarnActionFn = createServerFn({ method: "GET" })
  .inputValidator(actionInput)
  .handler(async ({ data }) => {
    const action = await getEarnAction(data.walletId, data.actionId);
    return { action };
  });
