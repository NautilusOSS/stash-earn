import process from "node:process";

import { readEnv } from "@/lib/env.server";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.
//
// When to use which env-access pattern:
//   - .server.ts module (this file): server-only helpers reused across
//     handlers. Wrap reads in a function so they run per-request.
//   - inline process.env inside a createServerFn handler: one-off reads
//     not reused elsewhere.
//   - import.meta.env.VITE_FOO: PUBLIC config readable from both client
//     and server (analytics IDs, public URLs). Define in .env with the
//     VITE_ prefix. Never put secrets here — they ship to the browser.

import { getBlinkServerConfig } from "@/lib/blink/config.server";

export function getServerConfig() {
  const blink = getBlinkServerConfig();
  return {
    nodeEnv: process.env.NODE_ENV,
    privy: {
      appId: readEnv("VITE_PRIVY_APP_ID") ?? readEnv("PRIVY_APP_ID"),
      appSecret: readEnv("PRIVY_APP_SECRET"),
      vaultId: readEnv("PRIVY_VAULT_ID") ?? readEnv("VITE_PRIVY_VAULT_ID"),
      /** App authorization key (wallet-auth:…). Optional if using user signers via access token. */
      authorizationPrivateKey: readEnv("PRIVY_AUTHORIZATION_PRIVATE_KEY"),
    },
    voi: {
      algodServer: process.env.VOI_ALGOD_SERVER,
      algodPort: process.env.VOI_ALGOD_PORT,
      algodToken: process.env.VOI_ALGOD_TOKEN,
      indexerServer: process.env.VOI_INDEXER_SERVER,
      indexerPort: process.env.VOI_INDEXER_PORT,
      indexerToken: process.env.VOI_INDEXER_TOKEN,
    },
    blink: {
      environment: blink.environment,
      merchantId: blink.merchantId,
      merchantPrivateKey: blink.merchantPrivateKey,
      chainId: blink.chainId,
      payUrl: blink.payUrl,
    },
  };
}
