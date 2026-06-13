import type { Address } from "viem";
import { createPublicClient, http, numberToHex } from "viem";
import { base } from "viem/chains";

const BASE_NETWORK = "eip155:8453" as const;
const SMOKE_TEST_AMOUNT = "$0.01";
const PROTECTED_PATH = "/api/x402/protected";

type PrivySignTypedData = (
  input: {
    domain: Record<string, unknown>;
    types: Record<string, Array<{ name: string; type: string }>>;
    primaryType: string;
    message: Record<string, unknown>;
  },
  options?: { address?: string },
) => Promise<{ signature: string }>;

/**
 * Format EIP-712 fields for Privy signing.
 * Decimal strings for uint256 produce invalid signatures — use number or hex.
 */
function serializeTypedDataValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    if (value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(value);
    }
    return numberToHex(value);
  }
  if (Array.isArray(value)) return value.map(serializeTypedDataValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        serializeTypedDataValue(entry),
      ]),
    );
  }
  return value;
}

function formatPrivyTypedData(input: {
  domain: Record<string, unknown>;
  types: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
}) {
  const types: Record<string, Array<{ name: string; type: string }>> = {};
  for (const [key, value] of Object.entries(input.types)) {
    if (Array.isArray(value)) {
      types[key] = value as Array<{ name: string; type: string }>;
    }
  }
  return {
    domain: serializeTypedDataValue(input.domain) as Record<string, unknown>,
    types,
    primaryType: input.primaryType,
    message: serializeTypedDataValue(input.message) as Record<string, unknown>,
  };
}

function createPrivyEvmSigner(address: Address, signTypedData: PrivySignTypedData) {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  return {
    address,
    signTypedData: async (input: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) => {
      const formatted = formatPrivyTypedData(input);
      const { signature } = await signTypedData(formatted, { address });
      return signature as `0x${string}`;
    },
    readContract: publicClient.readContract,
  };
}

/**
 * Manual x402 v2 fetch — avoids @x402/fetch processPaymentResult throws on failed settlement.
 */
export async function fetchWithX402Payment(
  input: RequestInfo | URL,
  walletAddress: string,
  signTypedData: PrivySignTypedData,
  init?: RequestInit,
): Promise<Response> {
  const [
    { x402Client, x402HTTPClient },
    { decodePaymentRequiredHeader },
    { toClientEvmSigner },
    { registerExactEvmScheme },
  ] = await Promise.all([
    import("@x402/core/client"),
    import("@x402/core/http"),
    import("@x402/evm"),
    import("@x402/evm/exact/client"),
  ]);

  const signer = toClientEvmSigner(
    createPrivyEvmSigner(walletAddress as Address, signTypedData),
    createPublicClient({ chain: base, transport: http() }),
  );

  const client = registerExactEvmScheme(new x402Client(), {
    signer,
    networks: [BASE_NETWORK],
    schemeOptions: { rpcUrl: base.rpcUrls.default.http[0] },
  });

  const httpClient = new x402HTTPClient(client);

  const first = await fetch(input, init);
  if (first.status !== 402) {
    return first;
  }

  const paymentRequiredHeader = first.headers.get("payment-required");
  if (!paymentRequiredHeader) {
    throw new Error("402 response missing payment-required header.");
  }

  const paymentRequired = decodePaymentRequiredHeader(paymentRequiredHeader);
  const paymentPayload = await client.createPaymentPayload(paymentRequired);

  // x402HTTPClient returns { "PAYMENT-SIGNATURE": base64 } — the standalone
  // encodePaymentSignatureHeader() from @x402/core/http returns only the string.
  const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(paymentHeaders)) {
    headers.set(key, value);
  }
  const signature =
    paymentHeaders["PAYMENT-SIGNATURE"] ?? paymentHeaders["X-PAYMENT"];
  if (signature) {
    headers.set("payment-signature", signature);
  }

  return fetch(input, { ...init, headers });
}

export function getX402ProtectedSmokeTestUrl(origin = window.location.origin): string {
  const params = new URLSearchParams({ amount: SMOKE_TEST_AMOUNT });
  return `${origin}${PROTECTED_PATH}?${params.toString()}`;
}

export const X402_SMOKE_TEST_AMOUNT = SMOKE_TEST_AMOUNT;

export function formatX402ClientError(error: unknown, responseBody?: string): string {
  if (responseBody?.includes("This page didn't load")) {
    return "Server error during x402 payment (check EVM_RPC_URL, EVM_PRIVATE_KEY gas, and server logs).";
  }
  if (responseBody?.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(responseBody) as { error?: string; message?: string };
      return parsed.message ?? parsed.error ?? responseBody;
    } catch {
      // fall through
    }
  }
  if (error instanceof Error) return error.message;
  return "x402 smoke test failed";
}
