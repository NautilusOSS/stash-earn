import { Chacha20Poly1305 } from "@hpke/chacha20poly1305";
import { CipherSuite, DhkemP256HkdfSha256, HkdfSha256 } from "@hpke/core";

import { getServerConfig } from "../config.server";
import { getPrivyClient } from "./privy.server";

const PRIVY_WALLETS_AUTH_URL = "https://api.privy.io/v1/wallets/authenticate";

type WalletAuthenticateResponse = {
  authorization_key?: string;
  encrypted_authorization_key?: {
    encryption_type: string;
    encapsulated_key: string;
    ciphertext: string;
  };
  expires_at: number;
};

async function createP256KeyPair(): Promise<{ publicKey: Buffer; privateKey: Buffer }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  return {
    publicKey: Buffer.from(await crypto.subtle.exportKey("spki", keyPair.publicKey)),
    privateKey: Buffer.from(await crypto.subtle.exportKey("pkcs8", keyPair.privateKey)),
  };
}

async function decryptHpkeAuthorizationKey(
  privateKeyBase64: string,
  encapsulatedKey: string,
  ciphertext: string,
): Promise<string> {
  const suite = new CipherSuite({
    kem: new DhkemP256HkdfSha256(),
    kdf: new HkdfSha256(),
    aead: new Chacha20Poly1305(),
  });

  const recipientKey = await crypto.subtle.importKey(
    "pkcs8",
    Uint8Array.from(atob(privateKeyBase64), (char) => char.charCodeAt(0)).buffer,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"],
  );

  const recipient = await suite.createRecipientContext({
    recipientKey,
    enc: Uint8Array.from(atob(encapsulatedKey), (char) => char.charCodeAt(0)).buffer,
  });

  return new TextDecoder().decode(
    await recipient.open(Uint8Array.from(atob(ciphertext), (char) => char.charCodeAt(0)).buffer),
  );
}

function getPrivyCredentials() {
  const config = getServerConfig();
  const appId = config.privy.appId;
  const appSecret = config.privy.appSecret;
  if (!appId || !appSecret) {
    throw new Error("Privy is not configured. Set VITE_PRIVY_APP_ID and PRIVY_APP_SECRET.");
  }
  return { appId, appSecret };
}

/** Exchange a user access token for an ephemeral wallet authorization key. */
export async function authenticateUserWalletSession(accessToken: string): Promise<string> {
  const privy = getPrivyClient();
  try {
    await privy.verifyAuthToken(accessToken);
  } catch {
    throw new Error("Your session expired. Sign in again and retry.");
  }

  const { appId, appSecret } = getPrivyCredentials();
  const userJwt = accessToken.replace(/^Bearer /, "");
  const { publicKey, privateKey } = await createP256KeyPair();
  const credentials = Buffer.from(`${appId}:${appSecret}`).toString("base64");

  const response = await fetch(PRIVY_WALLETS_AUTH_URL, {
    method: "POST",
    headers: {
      "privy-app-id": appId,
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_jwt: userJwt,
      encryption_type: "HPKE",
      recipient_public_key: publicKey.toString("base64"),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401 || /invalid jwt/i.test(body)) {
      throw new Error("Your session expired. Sign in again and retry.");
    }
    throw new Error(`Privy wallet authentication failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as WalletAuthenticateResponse;

  if (data.authorization_key) {
    return data.authorization_key;
  }

  const encrypted = data.encrypted_authorization_key;
  if (encrypted) {
    return decryptHpkeAuthorizationKey(
      privateKey.toString("base64"),
      encrypted.encapsulated_key,
      encrypted.ciphertext,
    );
  }

  throw new Error("Privy did not return a wallet authorization key.");
}
