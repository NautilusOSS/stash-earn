import { createSign, randomUUID } from "node:crypto";

import { getBlinkServerConfig } from "@/lib/blink/config.server";
import { verifyPrivyAccessToken } from "@/lib/privy/session.server";
import { getPrivyClient } from "@/lib/privy/privy.server";
import { validateEvmAddress } from "@/lib/xchain/validate";

export type BlinkSignerRequestBody = {
  amount: number;
  chainId: number;
  address: string;
  token: string;
  callbackScheme: string | null;
  url: string;
  version: string;
  reference?: string;
  metadata?: Record<string, string>;
};

export type BlinkSignerResponseBody = {
  merchantId: string;
  payload: string;
  signature: string;
  preview: {
    amount: number;
    chainId: number;
    address: string;
    token: string;
    idempotencyKey: string;
  };
};

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const CALLBACK_SCHEME_RE = /^[a-zA-Z][a-zA-Z0-9+\-.]*$/;

function getBlinkSignerCredentials() {
  const config = getBlinkServerConfig();
  const merchantId = config.merchantId;
  const merchantPrivateKey = config.merchantPrivateKey;

  if (!merchantId || !merchantPrivateKey) {
    throw new Error(
      "Blink is not configured. Set BLINK_MERCHANT_ID and BLINK_MERCHANT_PRIVATE_KEY.",
    );
  }

  return { merchantId, merchantPrivateKey, chainId: config.chainId, usdc: config.usdc, payUrl: config.payUrl };
}

function validateSignerRequest(
  body: BlinkSignerRequestBody,
  expectedChainId: number,
  expectedUsdc: string,
): string | null {
  if (!Number.isFinite(body.amount) || body.amount <= 0) {
    return "amount must be a positive number";
  }

  if (!Number.isInteger(body.chainId) || body.chainId <= 0) {
    return "chainId must be a positive integer";
  }

  if (body.chainId !== expectedChainId) {
    return `chainId must be ${expectedChainId} for the configured Blink environment`;
  }

  if (!EVM_ADDRESS_RE.test(body.address)) {
    return "address must be a valid EVM address";
  }

  if (body.token.toLowerCase() !== expectedUsdc.toLowerCase()) {
    return "token must match configured Blink USDC for this environment";
  }

  if (
    body.callbackScheme !== null &&
    (typeof body.callbackScheme !== "string" || !CALLBACK_SCHEME_RE.test(body.callbackScheme))
  ) {
    return "callbackScheme must be null or a valid URL scheme";
  }

  if (!body.version || typeof body.version !== "string") {
    return "version is required";
  }

  return null;
}

function normalizeBlinkToken(token: string): string {
  // Relay / Blink token lookup indexes lowercase addresses (see api.testnets.relay.link/chains).
  return token.toLowerCase();
}

async function verifyDestinationOwnership(authToken: string, address: string): Promise<boolean> {
  const { userId } = await verifyPrivyAccessToken(authToken);
  const privy = getPrivyClient();
  const user = await privy.getUserById(userId);

  const normalized = address.toLowerCase();
  const linked = user.linkedAccounts
    .filter((account) => account.type === "wallet" && "address" in account)
    .map((account) => account.address.toLowerCase());

  return linked.includes(normalized);
}

function signPayload(payload: string, privateKeyPem: string): string {
  const signer = createSign("SHA256");
  signer.update(payload);
  signer.end();
  return signer.sign(privateKeyPem).toString("base64url");
}

export async function signBlinkPayment(
  authToken: string,
  body: BlinkSignerRequestBody,
): Promise<BlinkSignerResponseBody> {
  const blink = getBlinkSignerCredentials();

  const validationError = validateSignerRequest(body, blink.chainId, blink.usdc);
  if (validationError) {
    throw new Error(validationError);
  }

  const addressValidation = validateEvmAddress(body.address);
  if (!addressValidation.valid) {
    throw new Error(addressErrorMessage(addressValidation.error));
  }

  const ownsAddress = await verifyDestinationOwnership(authToken, addressValidation.normalized);
  if (!ownsAddress) {
    throw new Error("Destination address does not belong to the authenticated user.");
  }

  const { merchantId, merchantPrivateKey } = blink;
  const idempotencyKey = randomUUID();
  const signatureTimestamp = new Date().toISOString();
  const normalizedToken = normalizeBlinkToken(body.token);

  const payloadObject = {
    amount: body.amount,
    chainId: body.chainId,
    address: addressValidation.normalized,
    token: normalizedToken,
    idempotencyKey,
    callbackScheme: body.callbackScheme,
    signatureTimestamp,
    version: body.version,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payloadObject), "utf8").toString("base64url");
  const signature = signPayload(encodedPayload, merchantPrivateKey);

  return {
    merchantId,
    payload: encodedPayload,
    signature,
    preview: {
      amount: body.amount,
      chainId: body.chainId,
      address: addressValidation.normalized,
      token: normalizedToken,
      idempotencyKey,
    },
  };
}

function addressErrorMessage(error: string | undefined): string {
  return error ?? "Invalid destination address";
}

export function parseBlinkSignerRequest(request: Request): Promise<BlinkSignerRequestBody> {
  return request.json() as Promise<BlinkSignerRequestBody>;
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim() || null;
}

export async function handleBlinkSignPaymentRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const authToken = extractBearerToken(request);
  if (!authToken) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  try {
    const body = await parseBlinkSignerRequest(request);
    const blink = getBlinkServerConfig();

    if (!body.url) {
      body.url = blink.payUrl;
    }

    const response = await signBlinkPayment(authToken, body);
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signer failed";
    const status =
      message.includes("does not belong") ? 403
      : message.includes("not configured") ? 503
      : 400;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }
}
