import process from "node:process";

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

function normalizeEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function env(name: string): string | undefined {
  const fromProcess = normalizeEnvValue(process.env[name]);
  if (fromProcess) return fromProcess;

  if (name.startsWith("VITE_")) {
    const viteEnv = import.meta.env as Record<string, string | undefined>;
    return normalizeEnvValue(viteEnv[name]);
  }

  return undefined;
}

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    privy: {
      appId: env("VITE_PRIVY_APP_ID") ?? env("PRIVY_APP_ID"),
      appSecret: env("PRIVY_APP_SECRET"),
      vaultId: env("PRIVY_VAULT_ID") ?? env("VITE_PRIVY_VAULT_ID"),
    },
    voi: {
      algodServer: process.env.VOI_ALGOD_SERVER,
      algodPort: process.env.VOI_ALGOD_PORT,
      algodToken: process.env.VOI_ALGOD_TOKEN,
      indexerServer: process.env.VOI_INDEXER_SERVER,
      indexerPort: process.env.VOI_INDEXER_PORT,
      indexerToken: process.env.VOI_INDEXER_TOKEN,
    },
  };
}
