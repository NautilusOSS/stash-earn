import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  depositToEarnVault,
  getEarnAction,
  getEarnPositionForUser,
  getEarnVaultDetails,
  isEarnConfigured,
  pollEarnAction,
  withdrawFromEarnVault,
} from "@/lib/privy/earn.server";

const accessTokenInput = z.object({
  accessToken: z.string().min(1),
});

const positionInput = accessTokenInput.extend({
  evmAddress: z.string().min(1),
});

const amountInput = positionInput.extend({
  rawAmount: z.string().regex(/^\d+$/),
});

const actionInput = z.object({
  actionId: z.string().min(1),
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

/** Deposit Base USDC into the Privy Earn vault. */
export const earnDepositFn = createServerFn({ method: "POST" })
  .inputValidator(amountInput)
  .handler(async ({ data }) => {
    const result = await depositToEarnVault(data.accessToken, data.evmAddress, data.rawAmount);
    const action = await pollEarnAction(result.action.id);
    return { action };
  });

/** Withdraw USDC (plus yield) from the Privy Earn vault. */
export const earnWithdrawFn = createServerFn({ method: "POST" })
  .inputValidator(amountInput)
  .handler(async ({ data }) => {
    const result = await withdrawFromEarnVault(data.accessToken, data.evmAddress, data.rawAmount);
    const action = await pollEarnAction(result.action.id);
    return { action };
  });

/** Poll a single earn wallet action by ID. */
export const getEarnActionFn = createServerFn({ method: "GET" })
  .inputValidator(actionInput)
  .handler(async ({ data }) => {
    const action = await getEarnAction(data.actionId);
    return { action };
  });
