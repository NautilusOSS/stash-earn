import { Hono } from "hono";

import { MisconfiguredServerError } from "../x402/config";
import type { VoiUsdcDistributionResult } from "../x402/distribute-voi-usdc.server";
import { jsonError, X402_ERRORS } from "../x402/errors";
import { createPaymentGate } from "../x402/middleware";
import { buildPaymentQuote, encodePaymentRequired } from "../x402/quote";
import { isEvmSettlementConfigured } from "../x402/settle-evm";
import type { PaymentQuoteRequest } from "../x402/types";

const API_PREFIX = "/api/x402";

/**
 * Hono router for /api/x402/*
 *
 * SECURITY: All routes in this module are server-only. Clients receive payment
 * requirements and public addresses only — never EVM_PRIVATE_KEY or ALGORAND_MNEMONIC.
 */
export function createX402Router(): Hono {
  const app = new Hono<{
    Variables: { voiUsdcDistribution?: VoiUsdcDistributionResult };
  }>();

  app.onError((error, c) => {
    console.error("[x402]", error);
    if (error instanceof MisconfiguredServerError) {
      return jsonError(c, 500, X402_ERRORS.misconfigured, { message: error.message });
    }
    return jsonError(c, 500, "Server error", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  });

  app.get(`${API_PREFIX}/health`, (c) =>
    c.json({
      ok: true,
      evmConfigured: isEvmSettlementConfigured(),
    }),
  );

  app.post(`${API_PREFIX}/quote`, async (c) => {
    try {
      const body = (await c.req.json()) as PaymentQuoteRequest;
      const quote = await buildPaymentQuote(body, c.req.url);
      const header = encodePaymentRequired(quote.paymentRequired);
      c.header("payment-required", header);
      return c.json(quote);
    } catch (error) {
      if (error instanceof MisconfiguredServerError) {
        return jsonError(c, 500, X402_ERRORS.misconfigured, {
          message: error.message,
        });
      }
      return jsonError(c, 400, "Invalid quote request", {
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  app.use(
    `${API_PREFIX}/protected`,
    createPaymentGate({
      path: `${API_PREFIX}/protected`,
      description: "Protected test resource (x402 USDC paywall)",
    }),
  );

  app.get(`${API_PREFIX}/protected`, (c) => {
    const voi = c.get("voiUsdcDistribution");
    return c.json({
      resource: "protected",
      message: "Access granted after USDC payment.",
      timestamp: new Date().toISOString(),
      voiUsdc: voi?.txId
        ? {
            recipient: voi.recipientAddress,
            amountAtomic: voi.amountAtomic,
            txId: voi.txId,
          }
        : voi
          ? {
              recipient: voi.recipientAddress,
              skipped: voi.skippedReason,
              error: voi.error,
            }
          : undefined,
    });
  });

  return app;
}

let routerInstance: Hono | undefined;

export function getX402Router(): Hono {
  if (!routerInstance) {
    routerInstance = createX402Router();
  }
  return routerInstance;
}

export async function handleX402Request(request: Request): Promise<Response> {
  return getX402Router().fetch(request);
}
