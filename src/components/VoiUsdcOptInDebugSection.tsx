import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

import { usePlatformAvmUsdcOptIn } from "@/hooks/usePlatformAvmUsdcOptIn";
import { truncateAddress } from "@/lib/privy/constants";
import { fmtUSD } from "@/lib/stash";
import { VOI_BLOCK_EXPLORER_TX, VOI_USDC_ASSET_ID } from "@/lib/voi/constants";

/**
 * Debug-only: USDC (ASA 302190) opt-in status for the platform AVM account
 * derived from ALGORAND_MNEMONIC. Opt-in is server-signed (no wallet prompt).
 */
export function VoiUsdcOptInDebugSection() {
  const {
    status,
    isLoadingStatus,
    statusError,
    optedIn,
    isConfigured,
    optIn,
    isOptingIn,
    optInResult,
    optInError,
  } = usePlatformAvmUsdcOptIn();

  const statusLabel = !isConfigured
    ? "ALGORAND_MNEMONIC not set"
    : isLoadingStatus
      ? "Checking…"
      : statusError
        ? "Error"
        : optedIn
          ? "Opted in"
          : "Not opted in";

  const txId = optInResult?.txId;

  return (
    <div className="px-4 py-3.5">
      <p className="text-xs text-muted-foreground">Platform AVM USDC opt-in</p>
      <p className="mt-1 text-sm text-muted-foreground">
        ASA <span className="font-mono text-foreground">{VOI_USDC_ASSET_ID}</span> on mnemonic
        account{" "}
        {status?.avmAddress ? truncateAddress(status.avmAddress) : "—"}
      </p>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p
              className={
                optedIn
                  ? "text-sm font-medium text-positive"
                  : "text-sm font-medium text-foreground"
              }
            >
              {statusLabel}
            </p>
          </div>
          {isLoadingStatus ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
        </div>
        {isConfigured ? (
          <>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">VOI balance</p>
              <p className="text-sm font-medium tabular-nums">
                {isLoadingStatus ? "…" : `${(status?.voiBalance ?? 0).toFixed(4)} VOI`}
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">USDC balance</p>
              <p className="text-sm font-medium tabular-nums">
                {isLoadingStatus ? "…" : fmtUSD(status?.balance ?? 0)}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {statusError ? <p className="mt-2 text-sm text-destructive">{statusError}</p> : null}

      {isConfigured && !optedIn && !isLoadingStatus && !statusError ? (
        <button
          type="button"
          onClick={() => void optIn()}
          disabled={isOptingIn}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium disabled:opacity-50"
        >
          {isOptingIn ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Opting in…
            </>
          ) : (
            "Opt in platform AVM account"
          )}
        </button>
      ) : null}

      {optInError ? <p className="mt-2 text-sm text-destructive">{optInError}</p> : null}

      {txId ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-positive/10 px-3 py-2 text-sm text-positive">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">USDC opt-in confirmed</p>
            <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">{txId}</p>
            <a
              href={`${VOI_BLOCK_EXPLORER_TX}/${txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2"
            >
              View on block.voi.network
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
