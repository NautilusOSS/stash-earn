import { createFileRoute } from "@tanstack/react-router";

import { handleBlinkSignPaymentRequest } from "@/lib/blink/sign-payment.server";

/**
 * Blink deposit signer — Node crypto (ECDSA P-256). Requires Privy Bearer auth.
 * POST /api/blink/sign-payment
 */
export const Route = createFileRoute("/api/blink/sign-payment")({
  server: {
    handlers: {
      POST: async ({ request }) => handleBlinkSignPaymentRequest(request),
    },
  },
});
