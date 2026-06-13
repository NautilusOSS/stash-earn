import type { PaymentPayload, PaymentRequirements, SettleResponse } from "@x402/core/types";

/** Request body for POST /api/x402/quote */
export interface PaymentQuoteRequest {
  amount: string;
  network?: string;
  token?: string;
  resourceId: string;
  memo?: string;
}

/** Server-built quote returned to clients before they sign a payment authorization. */
export interface PaymentQuote {
  quoteId: string;
  resourceId: string;
  memo?: string;
  network: string;
  token: string;
  amount: string;
  amountAtomic: string;
  payTo: string;
  scheme: string;
  maxTimeoutSeconds: number;
  requirements: PaymentRequirement;
  paymentRequired: PaymentRequiredPayload;
}

/** Single x402 payment requirement row (subset of SDK PaymentRequirements). */
export interface PaymentRequirement {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: Record<string, unknown>;
}

/** x402 PaymentRequired payload (v2) for 402 responses and quote API. */
export interface PaymentRequiredPayload {
  x402Version: number;
  error?: string;
  resource: {
    url: string;
    description?: string;
    mimeType?: string;
  };
  accepts: PaymentRequirement[];
}

export type PaymentVerificationStatus =
  | "valid"
  | "missing"
  | "invalid_payload"
  | "underpaid"
  | "wrong_recipient"
  | "wrong_token"
  | "wrong_network"
  | "expired"
  | "replay"
  | "verify_failed";

/** Result of server-side payment verification (before settlement). */
export interface PaymentVerificationResult {
  status: PaymentVerificationStatus;
  message: string;
  paymentPayload?: PaymentPayload;
  requirements?: PaymentRequirements;
  payer?: string;
  verifyResponse?: {
    isValid: boolean;
    invalidReason?: string;
  };
}

/** Record stored after successful settlement for replay protection. */
export interface SettledPayment {
  paymentId: string;
  resourceId?: string;
  payer: string;
  payTo: string;
  amount: string;
  asset: string;
  network: string;
  transaction: string;
  settledAt: string;
  voiUsdcRecipient?: string;
  voiUsdcTransfer?: string;
  voiUsdcTransferError?: string;
}

export interface SettleEvmResult {
  success: boolean;
  settleResponse?: SettleResponse;
  error?: string;
}
