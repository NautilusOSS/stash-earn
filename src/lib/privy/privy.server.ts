import { PrivyClient } from "@privy-io/server-auth";

import { getServerConfig } from "../config.server";

let client: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!client) {
    const config = getServerConfig();
    const appId = config.privy.appId;
    const appSecret = config.privy.appSecret;

    if (!appId || !appSecret) {
      throw new Error("Privy is not configured. Set VITE_PRIVY_APP_ID and PRIVY_APP_SECRET.");
    }

    client = new PrivyClient(appId, appSecret, {
      walletApi: config.privy.authorizationPrivateKey
        ? { authorizationPrivateKey: config.privy.authorizationPrivateKey }
        : undefined,
    });
  }

  return client;
}
