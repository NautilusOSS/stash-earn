import { decodePaymentSignatureHeader } from "@x402/core/http";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

import { formatX402VerifyFailure } from "@/lib/x402/messages";
import { normalizeEoaSignature } from "@/lib/x402/signature";

import { requireEvmSettlementConfig } from "./config";
import { verifyEip3009Payment } from "./eip3009.server";
import { probeEip3009SimulationRevert } from "./simulate-eip3009.server";
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

  const innerPayload = paymentPayload.payload as Record<string, unknown>;
  if (typeof innerPayload.signature === "string") {
    const normalized = normalizeEoaSignature(innerPayload.signature);
    if (normalized !== innerPayload.signature) {
      paymentPayload = {
        ...paymentPayload,
        payload: { ...innerPayload, signature: normalized },
      };
    }
  }

  if (!innerPayload.authorization) {
    return {
      status: "invalid_payload",
      message: "Only EIP-3009 USDC payments are supported.",
      paymentPayload,
      requirements,
    };
  }

  const localVerify = await verifyEip3009Payment(paymentPayload, requirements);
  if (!localVerify.isValid) {
    const invalidReason = localVerify.invalidReason;
    const payer = localVerify.payer;
    const simulationRevert =
      localVerify.simulationRevert ??
      (invalidReason.includes("transaction_simulation_failed")
        ? await probeEip3009SimulationRevert(paymentPayload, requirements)
        : null);

    console.error("[x402] verify failed", {
      invalidReason,
      simulationRevert,
      payer,
      amount: requirements.amount,
      payTo: requirements.payTo,
      network: requirements.network,
    });

    const baseMessage =
      formatX402VerifyFailure(invalidReason) ??
      invalidReason ??
      "Payment verification failed.";
    const message = simulationRevert
      ? `${baseMessage} Revert: ${simulationRevert}`
      : baseMessage;

    return {
      status: "verify_failed",
      message,
      paymentPayload,
      requirements,
      payer,
      verifyResponse: {
        isValid: false,
        invalidReason,
        simulationRevert: simulationRevert ?? undefined,
      },
    };
  }

  return {
    status: "valid",
    message: "Payment verified.",
    paymentPayload,
    requirements,
    payer: localVerify.payer,
    verifyResponse: { isValid: true },
  };
}
