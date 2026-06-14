import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  getX402FacilitatorDebugStatus,
  getX402SmokeDiagnostics,
} from "@/server/x402/facilitator-status.server";

const evmAddressInput = z.object({
  evmAddress: z.string().min(1),
});

/** x402 facilitator relayer address and Base ETH balance. */
export const getX402FacilitatorStatusFn = createServerFn({ method: "GET" }).handler(async () =>
  getX402FacilitatorDebugStatus(),
);

/** Facilitator + payer USDC balance via server EVM_RPC_URL. */
export const getX402SmokeDiagnosticsFn = createServerFn({ method: "GET" })
  .inputValidator(evmAddressInput)
  .handler(async ({ data }) =>
    getX402SmokeDiagnostics(data.evmAddress as `0x${string}`),
  );
