import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getDynamicConfigStatus } from "@/lib/dynamic/config.server";
import { createDynamicCheckoutTransaction } from "@/lib/dynamic/flow-api.server";
import { verifyPrivyAccessToken } from "@/lib/privy/session.server";
import { validateEvmAddress } from "@/lib/xchain/validate";

import { getDynamicServerConfig } from "@/lib/dynamic/config.server";

const createFlowDepositInput = z.object({
  accessToken: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  destinationAddress: z.string().min(1),
});

/** Whether Dynamic Fireblocks Flow checkout is configured on the server. */
export const getDynamicConfiguredFn = createServerFn({ method: "GET" }).handler(async () =>
  getDynamicConfigStatus(),
);

/** Start a Dynamic deposit session — returns a one-time session token for client-side flow steps. */
export const createFlowDepositFn = createServerFn({ method: "POST" })
  .inputValidator(createFlowDepositInput)
  .handler(async ({ data }) => {
    const config = getDynamicServerConfig();
    if (!config.environmentId || !config.checkoutId) {
      throw new Error("Dynamic Flow is not configured on this server.");
    }

    const validation = validateEvmAddress(data.destinationAddress);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const { userId } = await verifyPrivyAccessToken(data.accessToken);
    const depositId = crypto.randomUUID();

    const response = await createDynamicCheckoutTransaction({
      environmentId: config.environmentId,
      checkoutId: config.checkoutId,
      amount: data.amount,
      currency: "USD",
      destinationAddress: validation.normalized,
      memo: {
        privyUserId: userId,
        stashDepositId: depositId,
        purpose: "stash_deposit",
      },
    });

    return {
      transactionId: response.transaction.id,
      sessionToken: response.sessionToken,
      sessionExpiresAt: response.sessionExpiresAt,
      environmentId: config.environmentId,
      amount: response.transaction.amount,
      destinationAddress: validation.normalized,
    };
  });
