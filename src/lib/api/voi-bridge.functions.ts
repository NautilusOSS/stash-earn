import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  executeVoiBridgeTransfer,
  isVoiBridgeConfigured,
  prepareVoiBridgeTransfer,
} from "@/lib/stash/voi-bridge.server";

const accessTokenInput = z.object({
  accessToken: z.string().min(1),
});

const bridgeInput = accessTokenInput.extend({
  evmAddress: z.string().min(1),
  rawAmount: z.string().regex(/^\d+$/),
});

const walletActionAuthSchema = z.object({
  authorizationSignature: z.string().min(1),
  requestExpiry: z.string().min(1),
});

const executeBridgeInput = bridgeInput.extend({
  clientAuth: walletActionAuthSchema.optional(),
  signedBody: z.record(z.unknown()).optional(),
});

export const getVoiBridgeConfiguredFn = createServerFn({ method: "GET" }).handler(async () => ({
  configured: isVoiBridgeConfigured(),
}));

export const prepareVoiBridgeTransferFn = createServerFn({ method: "POST" })
  .inputValidator(bridgeInput)
  .handler(async ({ data }) =>
    prepareVoiBridgeTransfer(data.accessToken, data.evmAddress, data.rawAmount),
  );

export const executeVoiBridgeTransferFn = createServerFn({ method: "POST" })
  .inputValidator(executeBridgeInput)
  .handler(async ({ data }) =>
    executeVoiBridgeTransfer(
      data.accessToken,
      data.evmAddress,
      data.rawAmount,
      data.clientAuth,
      data.signedBody,
    ),
  );
