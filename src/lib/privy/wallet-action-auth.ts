import { PRIVY_API_URL } from "./constants";

export const PRIVY_REQUEST_EXPIRY_MS = 30 * 60 * 1000;

/** Client-generated authorization signature for a Privy wallet API request. */
export type PrivyWalletActionAuth = {
  authorizationSignature: string;
  requestExpiry: string;
};

export type PrivyWalletActionAuthInput = {
  version: 1;
  method: "POST";
  url: string;
  body: Record<string, unknown>;
  headers: {
    "privy-app-id": string;
    "privy-request-expiry": string;
  };
};

export function buildPrivyWalletActionAuthInput(
  path: string,
  body: Record<string, unknown>,
  appId: string,
  requestExpiryMs = Date.now() + PRIVY_REQUEST_EXPIRY_MS,
): PrivyWalletActionAuthInput {
  return {
    version: 1,
    method: "POST",
    url: `${PRIVY_API_URL}${path}`,
    body,
    headers: {
      "privy-app-id": appId,
      "privy-request-expiry": String(requestExpiryMs),
    },
  };
}
