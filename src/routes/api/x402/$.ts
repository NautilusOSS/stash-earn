import { createFileRoute } from "@tanstack/react-router";

import { handleX402Request } from "@/server/routes/x402";

/**
 * TanStack Start mount for all /api/x402/* Hono routes.
 * SECURITY: Server-only — forwards to x402 payment gateway.
 */
export const Route = createFileRoute("/api/x402/$")({
  server: {
    handlers: {
      GET: async ({ request }) => handleX402Request(request),
      POST: async ({ request }) => handleX402Request(request),
    },
  },
});
