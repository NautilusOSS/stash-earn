import { CheckCircle2, ExternalLink, Loader2 } from "lucide-react";

import { useVoiUsdcOptIn } from "@/hooks/useVoiUsdcOptIn";
import { truncateAddress } from "@/lib/privy/constants";
import { VOI_BLOCK_EXPLORER_TX } from "@/lib/voi/constants";

type VoiUsdcOptInDebugSectionProps = {
  walletAddress: string | undefined;
};

/**
 * Debug-only: Voi mainnet USDC (ASA 302190) opt-in status and manual opt-in
 * via xChain execution address + EVM EIP-712 signing.
 */
export function VoiUsdcOptInDebugSection({ walletAddress }: VoiUsdcOptInDebugSectionProps) {
  const {
    assetId,
    status,
    isLoadingStatus,
    statusError,
    optedIn,
    optIn,
    isBusy,
    isPreparing,
    isSigning,
    isSubmitting,
    submitResult,
    error,
  } = useVoiUsdcOptIn(walletAddress);

  const statusLabel = isLoadingStatus
    ? "Checking…"
    : statusError
      ? "Error"
      : optedIn
        ? "Opted in"
        : "Not opted in";

  return (
    <div className="px-4 py-3.5">
      <p className="text-xs text-muted-foreground">Voi USDC opt-in</p>
      <p className="mt-1 text-sm text-muted-foreground">
        ASA <span className="font-mono text-foreground">{assetId}</span> on execution address{" "}
        {status?.voiExecutionAddress ? truncateAddress(status.voiExecutionAddress) : "—"}
      </p>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
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
        {isLoadingStatus ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {statusError ? <p className="mt-2 text-sm text-destructive">{statusError}</p> : null}

      {!optedIn && !isLoadingStatus && !statusError ? (
        <button
          type="button"
          onClick={() => void optIn()}
          disabled={!walletAddress || isBusy}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium disabled:opacity-50"
        >
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isPreparing ? "Preparing…" : isSigning ? "Sign in wallet…" : "Submitting…"}
            </>
          ) : (
            "Opt in to USDC on Voi"
          )}
        </button>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {submitResult ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-positive/10 px-3 py-2 text-sm text-positive">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">USDC opt-in confirmed</p>
            <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
              {submitResult.txId}
            </p>
            <a
              href={`${VOI_BLOCK_EXPLORER_TX}/${submitResult.txId}`}
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
