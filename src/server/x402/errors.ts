import type { Context } from "hono";

import { encodePaymentRequiredHeader } from "@x402/core/http";

import type { PaymentRequiredPayload } from "./types";

export function jsonError(c: Context, status: number, error: string, details?: Record<string, unknown>) {
  return c.json({ error, ...details }, status as 400 | 402 | 409 | 500 | 503);
}

export function paymentRequired(c: Context, paymentRequired: PaymentRequiredPayload) {
  c.header("payment-required", encodePaymentRequiredHeader(paymentRequired as never));
  return c.json({ error: X402_ERRORS.paymentRequired }, 402);
}

export const X402_ERRORS = {
  paymentRequired: "Payment Required",
  paymentVerificationFailed: "Payment verification failed",
  invalidPayload: "Invalid payment payload",
  underpaid: "Underpaid",
  replay: "Replay detected",
  misconfigured: "Misconfigured server",
} as const;
