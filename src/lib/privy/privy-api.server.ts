import { generateAuthorizationSignature } from "@privy-io/server-auth/wallet-api";

import { getServerConfig } from "../config.server";
import { PRIVY_API_URL } from "./constants";
import { authenticateUserWalletSession } from "./wallet-session.server";
import type { PrivyWalletActionAuth } from "./wallet-action-auth";

export const PRIVY_API_BASE = PRIVY_API_URL;

/** Reuse a user signer across multiple wallet actions in one request. */
export type PrivyAuthorizationContext = {
  authorizationPrivateKey?: string;
};

function getPrivyCredentials() {
  const config = getServerConfig();
  const appId = config.privy.appId;
  const appSecret = config.privy.appSecret;
  if (!appId || !appSecret) {
    throw new Error("Privy is not configured. Set VITE_PRIVY_APP_ID and PRIVY_APP_SECRET.");
  }
  return { appId, appSecret };
}

async function resolveAuthorizationPrivateKey(
  accessToken: string,
  authCtx?: PrivyAuthorizationContext,
): Promise<string> {
  if (authCtx?.authorizationPrivateKey) {
    return authCtx.authorizationPrivateKey;
  }

  const config = getServerConfig();
  if (config.privy.authorizationPrivateKey) {
    return config.privy.authorizationPrivateKey;
  }

  const authorizationKey = await authenticateUserWalletSession(accessToken);

  if (authCtx) {
    authCtx.authorizationPrivateKey = authorizationKey;
  }

  return authorizationKey;
}

function authorizationHeaders(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body: unknown,
  appId: string,
  authorizationPrivateKey: string,
): Record<string, string> {
  const signature = generateAuthorizationSignature({
    input: {
      method,
      url,
      body,
      headers: { "privy-app-id": appId },
    },
    authorizationPrivateKey,
  });

  if (!signature) {
    throw new Error("Failed to generate Privy authorization signature.");
  }

  return { "privy-authorization-signature": signature };
}

/** Unsigned Privy API read (vault details, positions, action polling). */
export async function privyApiGet<T>(path: string): Promise<T> {
  const { appId, appSecret } = getPrivyCredentials();
  const credentials = Buffer.from(`${appId}:${appSecret}`).toString("base64");

  const response = await fetch(`${PRIVY_API_BASE}${path}`, {
    headers: {
      "privy-app-id": appId,
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Privy API ${response.status} ${path}: ${responseBody || "(empty)"}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/** Signed Privy wallet action (transfer, earn deposit/withdraw). */
export async function privyWalletAction<T>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
  authCtx?: PrivyAuthorizationContext,
  clientAuth?: PrivyWalletActionAuth,
): Promise<T> {
  const { appId, appSecret } = getPrivyCredentials();
  const credentials = Buffer.from(`${appId}:${appSecret}`).toString("base64");
  const method = "POST" as const;
  const url = `${PRIVY_API_BASE}${path}`;

  let signedHeaders: Record<string, string>;
  if (clientAuth) {
    signedHeaders = {
      "privy-authorization-signature": clientAuth.authorizationSignature,
      "privy-request-expiry": clientAuth.requestExpiry,
    };
  } else {
    const authorizationPrivateKey = await resolveAuthorizationPrivateKey(accessToken, authCtx);
    signedHeaders = authorizationHeaders(method, url, body, appId, authorizationPrivateKey);
  }

  const response = await fetch(url, {
    method,
    headers: {
      "privy-app-id": appId,
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      ...signedHeaders,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(`Privy API ${response.status} ${path}: ${responseBody || "(empty)"}`);
  }

  return (await response.json()) as T;
}
