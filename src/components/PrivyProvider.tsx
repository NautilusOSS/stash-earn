import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { base, baseSepolia } from "viem/chains";
import { useEffect, useState, type ReactNode } from "react";

import { getBlinkEnvironmentClient } from "@/lib/blink/config";
import { getPrivyAppId } from "@/lib/privy/constants";

function PrivyConfigProvider({ children }: { children: ReactNode }) {
  const appId = getPrivyAppId();
  const blinkSandbox = getBlinkEnvironmentClient() === "sandbox";
  const supportedChains = blinkSandbox ? [base, baseSepolia] : [base];

  if (!appId) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <p className="font-display text-2xl">Configuration needed</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Set <code className="text-foreground">VITE_PRIVY_APP_ID</code> in your{" "}
            <code className="text-foreground">.env</code> file. Create an app at{" "}
            <a
              href="https://dashboard.privy.io"
              className="font-medium text-foreground underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              dashboard.privy.io
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  return (
    <BasePrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "light",
          accentColor: "#3d8b6e",
          logo: undefined,
          walletChainType: "ethereum-only",
          walletList: ["metamask", "coinbase_wallet", "wallet_connect", "rainbow"],
        },
        loginMethods: ["email", "passkey", "google", "apple"],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
        defaultChain: base,
        supportedChains,
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}

export function AppPrivyProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
      </div>
    );
  }

  return <PrivyConfigProvider>{children}</PrivyConfigProvider>;
}
