// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    optimizeDeps: {
      // Pre-bundle Privy + wallet SDKs so funding modals don't hit stale dep 504s in dev.
      include: [
        "@privy-io/react-auth",
        "@privy-io/api-types",
        "@coinbase/wallet-sdk",
        "@walletconnect/ethereum-provider",
        "@metamask/sdk",
        "@swype-org/deposit",
        "@swype-org/deposit/react",
      ],
    },
  },
});
