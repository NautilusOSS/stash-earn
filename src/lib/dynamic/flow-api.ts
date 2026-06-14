import type {
  DynamicCheckoutTransaction,
  DynamicCreateTransactionResponse,
  DynamicFlowQuote,
} from "@/lib/dynamic/types";

export const DYNAMIC_API_BASE = "https://app.dynamicauth.com/api/v0";

export class DynamicFlowApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DynamicFlowApiError";
    this.status = status;
  }
}

async function parseDynamicError(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  if (!text) return `Dynamic API returned HTTP ${res.status}`;
  try {
    const json = JSON.parse(text) as { message?: string; error?: string };
    return json.message ?? json.error ?? text;
  } catch {
    return text;
  }
}

export async function dynamicFlowFetch<T>(
  path: string,
  options: RequestInit & { sessionToken?: string } = {},
): Promise<T> {
  const { sessionToken, headers, ...rest } = options;
  const res = await fetch(`${DYNAMIC_API_BASE}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(sessionToken ? { "x-dynamic-checkout-session-token": sessionToken } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    throw new DynamicFlowApiError(res.status, await parseDynamicError(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

export async function createDynamicCheckoutTransaction(params: {
  environmentId: string;
  checkoutId: string;
  amount: string;
  currency: string;
  destinationAddress: string;
  memo?: Record<string, string>;
}): Promise<DynamicCreateTransactionResponse> {
  return dynamicFlowFetch<DynamicCreateTransactionResponse>(
    `/sdk/${params.environmentId}/checkouts/${params.checkoutId}/transactions`,
    {
      method: "POST",
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        destinationAddresses: [
          { address: params.destinationAddress, chainName: "EVM" },
        ],
        memo: params.memo,
      }),
    },
  );
}

export async function attachDynamicFlowSource(params: {
  environmentId: string;
  transactionId: string;
  sessionToken: string;
  fromAddress: string;
  fromChainId: string;
  fromChainName: "EVM";
}): Promise<DynamicCheckoutTransaction> {
  return dynamicFlowFetch<DynamicCheckoutTransaction>(
    `/sdk/${params.environmentId}/transactions/${params.transactionId}/source`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
      body: JSON.stringify({
        sourceType: "wallet",
        fromAddress: params.fromAddress,
        fromChainId: params.fromChainId,
        fromChainName: params.fromChainName,
      }),
    },
  );
}

export async function getDynamicFlowQuote(params: {
  environmentId: string;
  transactionId: string;
  sessionToken: string;
  fromTokenAddress: string;
  slippage?: number;
}): Promise<DynamicCheckoutTransaction> {
  return dynamicFlowFetch<DynamicCheckoutTransaction>(
    `/sdk/${params.environmentId}/transactions/${params.transactionId}/quote`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
      body: JSON.stringify({
        fromTokenAddress: params.fromTokenAddress,
        ...(params.slippage != null ? { slippage: params.slippage } : {}),
      }),
    },
  );
}

export async function prepareDynamicFlowTransaction(params: {
  environmentId: string;
  transactionId: string;
  sessionToken: string;
}): Promise<DynamicCheckoutTransaction> {
  return dynamicFlowFetch<DynamicCheckoutTransaction>(
    `/sdk/${params.environmentId}/transactions/${params.transactionId}/prepare`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
      body: JSON.stringify({
        assertBalanceForGasCost: true,
        assertBalanceForTransferAmount: true,
      }),
    },
  );
}

export async function broadcastDynamicFlowTransaction(params: {
  environmentId: string;
  transactionId: string;
  sessionToken: string;
  txHash: string;
}): Promise<DynamicCheckoutTransaction> {
  return dynamicFlowFetch<DynamicCheckoutTransaction>(
    `/sdk/${params.environmentId}/transactions/${params.transactionId}/broadcast`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
      body: JSON.stringify({ txHash: params.txHash }),
    },
  );
}

export async function cancelDynamicFlowTransaction(params: {
  environmentId: string;
  transactionId: string;
  sessionToken: string;
}): Promise<DynamicCheckoutTransaction> {
  return dynamicFlowFetch<DynamicCheckoutTransaction>(
    `/sdk/${params.environmentId}/transactions/${params.transactionId}/cancel`,
    {
      method: "POST",
      sessionToken: params.sessionToken,
    },
  );
}

export async function getDynamicFlowTransaction(params: {
  environmentId: string;
  transactionId: string;
}): Promise<DynamicCheckoutTransaction> {
  return dynamicFlowFetch<DynamicCheckoutTransaction>(
    `/sdk/${params.environmentId}/transactions/${params.transactionId}`,
    { method: "GET" },
  );
}

export function isDynamicFlowTerminal(tx: DynamicCheckoutTransaction): boolean {
  return (
    tx.settlementState === "completed" ||
    tx.settlementState === "failed" ||
    tx.executionState === "failed" ||
    tx.executionState === "cancelled" ||
    tx.executionState === "expired"
  );
}

export function isDynamicFlowSuccess(tx: DynamicCheckoutTransaction): boolean {
  return tx.settlementState === "completed";
}

export function getSettledUsdcAmount(
  quote: DynamicFlowQuote | undefined,
  fallback: string,
): string {
  return quote?.toAmount ?? fallback;
}

export async function waitForDynamicRiskCleared(params: {
  environmentId: string;
  transactionId: string;
  maxWaitMs?: number;
  pollMs?: number;
}): Promise<void> {
  const maxWaitMs = params.maxWaitMs ?? 30_000;
  const pollMs = params.pollMs ?? 2_000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    const tx = await getDynamicFlowTransaction({
      environmentId: params.environmentId,
      transactionId: params.transactionId,
    });
    if (tx.riskState === "cleared") return;
    if (tx.riskState === "blocked") {
      throw new DynamicFlowApiError(403, "Source wallet blocked by risk screening.");
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new DynamicFlowApiError(422, "Risk screening is still pending. Try again in a moment.");
}
