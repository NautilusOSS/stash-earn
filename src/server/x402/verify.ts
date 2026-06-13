import { decodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

import { requireEvmSettlementConfig } from "./config";
import { getLocalFacilitator } from "./settle-evm";
import type { PaymentVerificationResult } from "./types";

type EvmAuthorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
};

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

export function extractPaymentHeader(headers: Headers): string | undefined {
  return (
    headers.get("payment-signature") ??
    headers.get("PAYMENT-SIGNATURE") ??
    headers.get("x-payment") ??
    headers.get("X-PAYMENT") ??
    undefined
  );
}

export function decodePaymentPayload(headerValue: string): PaymentPayload {
  try {
    return decodePaymentSignatureHeader(headerValue);
  } catch {
    throw new Error("Invalid payment payload encoding.");
  }
}

/** x402 v2 stores network on `accepted`; v1 used top-level `network`. */
export function extractPayloadNetwork(payload: PaymentPayload): string | undefined {
  if (payload.accepted?.network) {
    return payload.accepted.network;
  }
  const legacy = payload as PaymentPayload & { network?: string };
  return legacy.network;
}

/** Stable id for replay protection (EIP-3009 nonce + payer). */
export function derivePaymentId(payload: PaymentPayload): string {
  const network = extractPayloadNetwork(payload) ?? "unknown";
  const inner = payload.payload as Record<string, unknown>;
  const auth = inner.authorization as EvmAuthorization | undefined;
  if (auth?.from && auth?.nonce) {
    return `evm:${network}:${auth.from.toLowerCase()}:${auth.nonce.toLowerCase()}`;
  }

  const permit2 = inner.permit2Authorization as { from?: string; nonce?: string } | undefined;
  if (permit2?.from && permit2?.nonce) {
    return `evm:${network}:${permit2.from.toLowerCase()}:permit2:${permit2.nonce}`;
  }

  return `evm:${network}:${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
}

export function extractPayer(payload: PaymentPayload): string | undefined {
  const inner = payload.payload as Record<string, unknown>;
  const auth = inner.authorization as EvmAuthorization | undefined;
  if (auth?.from) return auth.from;
  const permit2 = inner.permit2Authorization as { from?: string } | undefined;
  return permit2?.from;
}

function isExpired(payload: PaymentPayload): boolean {
  const inner = payload.payload as Record<string, unknown>;
  const auth = inner.authorization as EvmAuthorization | undefined;
  if (!auth?.validBefore) return false;
  const deadline = Number(auth.validBefore);
  return Number.isFinite(deadline) && deadline < Math.floor(Date.now() / 1000);
}

export function validateRequirementsBinding(
  requirements: PaymentRequirements,
  expected: {
    payTo: string;
    asset: string;
    network: string;
    resourceUrl?: string;
  },
): PaymentVerificationResult | null {
  if (normalizeAddress(requirements.payTo) !== normalizeAddress(expected.payTo)) {
    return {
      status: "wrong_recipient",
      message: "Payment recipient does not match server receiver.",
    };
  }

  if (normalizeAddress(requirements.asset) !== normalizeAddress(expected.asset)) {
    return {
      status: "wrong_token",
      message: "Payment token does not match USDC contract.",
    };
  }

  if (requirements.network !== expected.network) {
    return {
      status: "wrong_network",
      message: "Payment network does not match configured chain.",
    };
  }

  return null;
}

export async function verifyPaymentPayload(
  paymentHeader: string | undefined,
  requirements: PaymentRequirements,
  options?: { resourceUrl?: string },
): Promise<PaymentVerificationResult> {
  if (!paymentHeader) {
    return { status: "missing", message: "No payment signature header provided." };
  }

  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = decodePaymentPayload(paymentHeader);
  } catch (error) {
    return {
      status: "invalid_payload",
      message: error instanceof Error ? error.message : "Invalid payment payload",
    };
  }

  const evm = requireEvmSettlementConfig();
  const bindingError = validateRequirementsBinding(requirements, {
    payTo: evm.receiverAddress,
    asset: evm.usdcContractAddress,
    network: evm.network,
    resourceUrl: options?.resourceUrl,
  });

  if (bindingError) {
    return { ...bindingError, paymentPayload, requirements };
  }

  const payloadNetwork = extractPayloadNetwork(paymentPayload);
  if (!payloadNetwork) {
    return {
      status: "invalid_payload",
      message: "Payment payload is missing network (expected accepted.network in v2).",
      paymentPayload,
      requirements,
    };
  }

  if (payloadNetwork !== evm.network) {
    return {
      status: "wrong_network",
      message: `Payment payload network mismatch (payload: ${payloadNetwork}, server: ${evm.network}).`,
      paymentPayload,
      requirements,
    };
  }

  if (payloadNetwork !== requirements.network) {
    return {
      status: "wrong_network",
      message: "Payment payload network does not match payment requirements.",
      paymentPayload,
      requirements,
    };
  }

  if (isExpired(paymentPayload)) {
    return {
      status: "expired",
      message: "Payment authorization has expired.",
      paymentPayload,
      requirements,
    };
  }

  const inner = paymentPayload.payload as Record<string, unknown>;
  const auth = inner.authorization as EvmAuthorization | undefined;
  if (auth?.value && BigInt(auth.value) < BigInt(requirements.amount)) {
    return {
      status: "underpaid",
      message: "Signed authorization amount is below required minimum.",
      paymentPayload,
      requirements,
    };
  }

  const facilitator = getLocalFacilitator();
  let verifyResponse;
  try {
    verifyResponse = await facilitator.verify(paymentPayload, requirements);
  } catch (error) {
    return {
      status: "verify_failed",
      message: error instanceof Error ? error.message : "Facilitator verify failed.",
      paymentPayload,
      requirements,
      payer: extractPayer(paymentPayload),
    };
  }

  if (!verifyResponse.isValid) {
    return {
      status: "verify_failed",
      message: verifyResponse.invalidReason ?? "Facilitator rejected payment.",
      paymentPayload,
      requirements,
      payer: extractPayer(paymentPayload),
      verifyResponse: {
        isValid: false,
        invalidReason: verifyResponse.invalidReason,
      },
    };
  }

  return {
    status: "valid",
    message: "Payment verified.",
    paymentPayload,
    requirements,
    payer: verifyResponse.payer ?? extractPayer(paymentPayload),
    verifyResponse: { isValid: true },
  };
}
