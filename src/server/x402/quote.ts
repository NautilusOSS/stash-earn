import { randomUUID } from "node:crypto";

import { encodePaymentRequiredHeader } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import type { Network, Price } from "@x402/core/types";

import {
  getX402Config,
  MisconfiguredServerError,
  networkFromChainId,
  requireEvmSettlementConfig,
} from "./config";
import { isEvmSettlementConfigured } from "./settle-evm";
import type { PaymentQuote, PaymentQuoteRequest, PaymentRequirement, PaymentRequiredPayload } from "./types";

const priceScheme = new ExactEvmScheme();

function normalizeAddress(value: string): string {
  return value.toLowerCase();
}

function parseDollarAmount(amount: string): number {
  const trimmed = amount.trim();
  if (trimmed.startsWith("$")) {
    const n = Number(trimmed.slice(1));
    if (!Number.isFinite(n) || n <= 0) throw new Error("Amount must be a positive dollar value.");
    return n;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) throw new Error("Amount must be a positive number.");
  return n;
}

export function validateQuoteRequest(body: PaymentQuoteRequest): {
  amount: string;
  network: string;
  token: string;
  resourceId: string;
  memo?: string;
} {
  if (!body.resourceId?.trim()) {
    throw new Error("resourceId is required.");
  }

  if (!isEvmSettlementConfigured()) {
    throw new MisconfiguredServerError("EVM settlement is not configured.");
  }

  const evm = requireEvmSettlementConfig();
  const network = body.network ?? evm.network;
  const token = (body.token ?? evm.usdcContractAddress) as string;

  if (network !== evm.network) {
    throw new Error(`Unsupported network. Expected ${evm.network}.`);
  }

  if (normalizeAddress(token) !== normalizeAddress(evm.usdcContractAddress)) {
    throw new Error("Token must match USDC_CONTRACT_ADDRESS.");
  }

  const dollars = parseDollarAmount(body.amount);
  if (dollars > 100) {
    throw new Error("Amount exceeds server maximum ($100).");
  }

  return {
    amount: body.amount.trim().startsWith("$") ? body.amount.trim() : `$${dollars}`,
    network,
    token,
    resourceId: body.resourceId.trim(),
    memo: body.memo?.trim(),
  };
}

export async function buildPaymentQuote(
  request: PaymentQuoteRequest,
  resourceUrl: string,
): Promise<PaymentQuote> {
  const validated = validateQuoteRequest(request);
  const evm = requireEvmSettlementConfig();
  const { x402 } = getX402Config();

  const price: Price = validated.amount;
  const assetAmount = await priceScheme.parsePrice(price, validated.network as Network);

  const requirement: PaymentRequirement = {
    scheme: "exact",
    network: validated.network,
    amount: assetAmount.amount,
    asset: validated.token,
    payTo: evm.receiverAddress,
    maxTimeoutSeconds: x402.maxTimeoutSeconds,
    extra: assetAmount.extra,
  };

  const paymentRequired: PaymentRequiredPayload = {
    x402Version: 2,
    error: "Payment Required",
    resource: {
      url: resourceUrl,
      description: validated.memo ?? `Payment for ${validated.resourceId}`,
      mimeType: "application/json",
    },
    accepts: [requirement],
  };

  return {
    quoteId: randomUUID(),
    resourceId: validated.resourceId,
    memo: validated.memo,
    network: validated.network,
    token: validated.token,
    amount: validated.amount,
    amountAtomic: assetAmount.amount,
    payTo: evm.receiverAddress,
    scheme: "exact",
    maxTimeoutSeconds: x402.maxTimeoutSeconds,
    requirements: requirement,
    paymentRequired,
  };
}

export function encodePaymentRequired(paymentRequired: PaymentRequiredPayload): string {
  return encodePaymentRequiredHeader(paymentRequired as never);
}

export function defaultProtectedAmount(queryAmount?: string): string {
  const { x402 } = getX402Config();
  if (queryAmount?.trim()) {
    return queryAmount.trim().startsWith("$") ? queryAmount.trim() : `$${queryAmount.trim()}`;
  }
  return x402.defaultUsdcAmount;
}

export async function buildProtectedRequirements(
  resourceUrl: string,
  amount: string,
  description: string,
): Promise<{ requirement: PaymentRequirement; paymentRequired: PaymentRequiredPayload }> {
  const quote = await buildPaymentQuote(
    {
      amount,
      resourceId: "protected",
      memo: description,
    },
    resourceUrl,
  );
  return { requirement: quote.requirements, paymentRequired: quote.paymentRequired };
}

export function networkFromConfiguredChain(): string {
  const evm = requireEvmSettlementConfig();
  return networkFromChainId(evm.chainId);
}
