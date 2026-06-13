import { createServerFn } from "@tanstack/react-start";

import { getBlinkConfigStatus } from "@/lib/blink/config.server";

/** Whether Blink merchant ID + signing key are configured on the server. */
export const getBlinkConfiguredFn = createServerFn({ method: "GET" }).handler(async () =>
  getBlinkConfigStatus(),
);
