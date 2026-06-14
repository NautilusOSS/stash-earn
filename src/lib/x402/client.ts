import type { Address, TypedDataDefinition } from "viem";
import { createPublicClient, getAddress, http, isAddressEqual } from "viem";
import { base } from "viem/chains";

const BASE_NETWORK = "eip155:8453" as const;
const SMOKE_TEST_AMOUNT = "$0.01";
const PROTECTED_PATH = "/api/x402/protected";
export const X402_BRIDGE_PATH = "/api/x402/bridge";
export const X402_MAX_BRIDGE_USDC = 100;

/** Privy embedded wallet signer (see createPrivyX402Signer). */
export type X402EvmSigner = {
  address: Address;
  signTypedData: (input: {
    domain: TypedDataDefinition["domain"];
    types: TypedDataDefinition["types"];
    primaryType: string;
    message: Record<string, unknown>;
  }) => Promise<`0x${string}`>;
};

function createEvmSignerAdapter(signer: X402EvmSigner) {
  const publicClient = createPublicClient({
    chain: base,
    transport: http(),
  });

  return {
    address: signer.address,
    signTypedData: (input: {
      domain: TypedDataDefinition["domain"];
      types: TypedDataDefinition["types"];
      primaryType: string;
      message: Record<string, unknown>;
    }) => signer.signTypedData(input),
    readContract: publicClient.readContract,
  };
}

/**
 * Manual x402 v2 fetch — avoids @x402/fetch processPaymentResult throws on failed settlement.
 */
export async function fetchWithX402Payment(
  input: RequestInfo | URL,
  walletAddress: string,
  signer: X402EvmSigner,
  init?: RequestInit,
): Promise<Response> {
  if (!isAddressEqual(getAddress(walletAddress), getAddress(signer.address))) {
    throw new Error("Signer address does not match the connected wallet.");
  }

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

  const publicClient = createPublicClient({ chain: base, transport: http() });

  const clientSigner = toClientEvmSigner(
    createEvmSignerAdapter(signer),
    publicClient,
  );

  const client = registerExactEvmScheme(new x402Client(), {
    signer: clientSigner,
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

export function formatX402DollarAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Amount must be a positive dollar value.");
  }
  if (amount > X402_MAX_BRIDGE_USDC) {
    throw new Error(`Amount exceeds server maximum ($${X402_MAX_BRIDGE_USDC}).`);
  }
  return `$${amount.toFixed(2)}`;
}

export function getX402BridgeUrl(
  amount: number | string,
  origin = window.location.origin,
  path: string = X402_BRIDGE_PATH,
): string {
  const dollarAmount =
    typeof amount === "number" ? formatX402DollarAmount(amount) : amount.trim();
  const params = new URLSearchParams({ amount: dollarAmount });
  return `${origin}${path}?${params.toString()}`;
}

export function getX402ProtectedSmokeTestUrl(origin = window.location.origin): string {
  return getX402BridgeUrl(SMOKE_TEST_AMOUNT, origin, PROTECTED_PATH);
}

export const X402_SMOKE_TEST_AMOUNT = SMOKE_TEST_AMOUNT;

export type X402VoiUsdcMirror = {
  recipient?: string;
  amountAtomic?: string;
  txId?: string;
  skipped?: string;
  error?: string;
};

export type X402BridgeResponse = {
  resource: string;
  message: string;
  timestamp?: string;
  voiUsdc?: X402VoiUsdcMirror;
};

export { formatX402ClientError, parseX402DollarAmount } from "./messages";
