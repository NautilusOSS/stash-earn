import { usePrivy } from "@privy-io/react-auth";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

export function AuthGate({ children }: { children: ReactNode }) {
  const { ready, authenticated, login } = usePrivy();

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="flex min-h-dvh flex-col bg-background px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cash Stash</p>
          <h1 className="font-display mt-3 text-5xl leading-tight">
            A simple place to keep cash and earn yield.
          </h1>
          <p className="mt-4 text-base text-muted-foreground">
            Sign in to open your stash wallet on Base. Deposits earn yield through DeFi vaults
            powered by{" "}
            <a
              href="https://docs.privy.io/wallets/actions/earn/overview"
              className="text-foreground underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              Privy Earn
            </a>
            .
          </p>

          <div className="mt-8 rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-positive/15 text-positive">
                <Sparkles className="h-4 w-4" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[15px] font-medium">Embedded wallet included</p>
                <p className="text-xs text-muted-foreground">
                  Email, Google, Apple, or connect an existing wallet.
                </p>
              </div>
            </div>
          </div>

          <Button
            size="lg"
            onClick={login}
            className="mt-8 h-14 w-full rounded-2xl text-base font-semibold"
          >
            Get started
          </Button>
        </div>
      </div>
    );
  }

  return children;
}
