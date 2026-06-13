import { createServerFn } from "@tanstack/react-start";

import {
  getPlatformAvmUsdcOptInStatus,
  triggerPlatformAvmUsdcOptIn,
} from "@/server/platform-avm.server";

/** USDC opt-in status for the platform AVM account (ALGORAND_MNEMONIC). */
export const getPlatformAvmUsdcOptInStatusFn = createServerFn({ method: "GET" }).handler(
  async () => getPlatformAvmUsdcOptInStatus(),
);

/** Debug-only: opt platform AVM account into USDC on Voi (server-signed). */
export const triggerPlatformAvmUsdcOptInFn = createServerFn({ method: "POST" }).handler(
  async () => triggerPlatformAvmUsdcOptIn(),
);
