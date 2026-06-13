import { CheckCircle2, Loader2 } from "lucide-react";

import { useX402SmokeTest } from "@/hooks/useX402SmokeTest";

type X402DebugSectionProps = {
  walletAddress: string | undefined;
};

/**
 * Debug-only x402 smoke test on Base mainnet USDC.
 * Browser signs the payment authorization; server verifies and settles.
 */
export function X402DebugSection({ walletAddress }: X402DebugSectionProps) {
  const { runSmokeTest, isRunning, result, error, amount } = useX402SmokeTest(walletAddress);

  return (
    <div className="px-4 py-3.5">
      <p className="text-xs text-muted-foreground">x402 Base payment</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Pays {amount} USDC via x402 to unlock <code className="text-foreground">/api/x402/protected</code>.
      </p>

      <button
        type="button"
        onClick={runSmokeTest}
        disabled={!walletAddress || isRunning}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Paying & verifying…
          </>
        ) : (
          `Smoke test · ${amount} USDC`
        )}
      </button>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-positive/10 px-3 py-2 text-sm text-positive">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Payment succeeded</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{result.message}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
