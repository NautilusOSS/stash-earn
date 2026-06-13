import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";

import { useDorkfiUsdcDeposit } from "@/hooks/useDorkfiUsdcDeposit";
import { useXChainExecutionStatus } from "@/hooks/useXChainExecutionStatus";
import { useXChainUsdcOptIn } from "@/hooks/useXChainUsdcOptIn";
import { VOI_MAINNET_A_MARKET_USDC } from "@/lib/dorkfi/constants";
import { fmtUSD } from "@/lib/stash";
import { VOI_BLOCK_EXPLORER_TX } from "@/lib/voi/constants";

type DorkFiUsdcDepositSectionProps = {
  evmAddress: string | undefined;
};

export function DorkFiUsdcDepositSection({ evmAddress }: DorkFiUsdcDepositSectionProps) {
  const { status, isLoading, isFetching, error: statusError, refetch } =
    useXChainExecutionStatus(evmAddress);

  const {
    optInToUsdc,
    isPreparing: isOptInPreparing,
    isSigning: isOptInSigning,
    isSubmitting: isOptInSubmitting,
    submitResult: optInResult,
    error: optInError,
  } = useXChainUsdcOptIn(evmAddress);

  const {
    depositUsdc,
    isPreparing,
    isSigning,
    isSubmitting,
    submitResult,
    error: depositError,
  } = useDorkfiUsdcDeposit(evmAddress);

  const isOptInBusy = isOptInPreparing || isOptInSigning || isOptInSubmitting;
  const isDepositBusy = isPreparing || isSigning || isSubmitting;
  const hasUsdcToDeposit = status != null && status.usdcBalance > 0;
  const voiLow =
    status != null && status.spendableVoi < status.minSpendableVoiForDeposit;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">DorkFi USDC supply</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pool {VOI_MAINNET_A_MARKET_USDC.poolId} · market {VOI_MAINNET_A_MARKET_USDC.marketId} ·{" "}
            {VOI_MAINNET_A_MARKET_USDC.symbol}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isLoading || isFetching || !evmAddress}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-card disabled:opacity-50"
          aria-label="Refresh execution balances"
        >
          {isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading execution balances…
        </div>
      ) : statusError ? (
        <p className="text-sm text-destructive">{statusError}</p>
      ) : status ? (
        <div className="space-y-2 rounded-xl border border-border bg-secondary/20 p-3 text-sm">
          <BalanceRow
            label="USDC (ASA 302190)"
            value={fmtUSD(status.usdcBalance)}
            sub={status.usdcOptedIn ? "Opted in" : "Not opted in"}
            warn={!status.usdcOptedIn || !hasUsdcToDeposit}
          />
          <BalanceRow
            label="Spendable VOI"
            value={`${status.spendableVoi.toFixed(4)} VOI`}
            sub={`Need ≥${status.minSpendableVoiForDeposit} for supply fees`}
            warn={voiLow}
          />
          {status.nTokenOptedIn ? (
            <p className="text-xs text-muted-foreground">
              nToken ASA {status.nTokenId} opted in
            </p>
          ) : null}
        </div>
      ) : null}

      {!status?.usdcOptedIn && status ? (
        <button
          type="button"
          disabled={isOptInBusy || isDepositBusy}
          onClick={() => void optInToUsdc()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 text-sm font-medium disabled:opacity-50"
        >
          {isOptInBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isOptInPreparing ? "Preparing…" : isOptInSigning ? "Sign in wallet…" : "Submitting…"}
            </>
          ) : (
            "Sign & opt in to USDC on execution address"
          )}
        </button>
      ) : null}

      {optInError ? <p className="text-sm text-destructive">{optInError}</p> : null}

      {optInResult ? (
        <div className="flex items-start gap-2 rounded-xl bg-positive/10 px-3 py-2 text-sm text-positive">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">USDC opt-in confirmed</p>
            <a
              href={`${VOI_BLOCK_EXPLORER_TX}/${optInResult.txId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2"
            >
              View transaction
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      ) : null}

      {status?.usdcOptedIn && !hasUsdcToDeposit ? (
        <p className="text-xs text-destructive">
          Fund the execution address with USDC (ASA 302190) before depositing.
        </p>
      ) : null}

      {status?.usdcOptedIn && hasUsdcToDeposit && voiLow ? (
        <p className="text-xs text-destructive">
          Fund the execution address with ≥{status.minSpendableVoiForDeposit} VOI for supply fees.
        </p>
      ) : null}

      <button
        type="button"
        disabled={
          isDepositBusy ||
          isOptInBusy ||
          !status?.usdcOptedIn ||
          !hasUsdcToDeposit ||
          voiLow ||
          isLoading
        }
        onClick={() => void depositUsdc()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {isDepositBusy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {isPreparing ? "Preparing…" : isSigning ? "Sign in wallet…" : "Submitting…"}
          </>
        ) : (
          `Sign & deposit ${fmtUSD(status?.usdcBalance ?? 0)} USDC to DorkFi`
        )}
      </button>

      {depositError ? <p className="text-sm text-destructive">{depositError}</p> : null}

      {submitResult ? (
        <div className="rounded-xl border border-positive/30 bg-positive/5 p-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-positive" strokeWidth={1.75} />
            <div className="min-w-0 flex-1 space-y-2 text-sm">
              <p className="font-medium text-positive">Deposit confirmed</p>
              <p className="text-xs text-muted-foreground">
                Round {submitResult.confirmedRound}
              </p>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Pool application tx</p>
                <p className="break-all font-mono text-xs">{submitResult.poolApplTxId}</p>
                <a
                  href={submitResult.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2"
                >
                  View on block.voi.network
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Group tx</p>
                <p className="break-all font-mono text-xs">{submitResult.txId}</p>
                <a
                  href={`${VOI_BLOCK_EXPLORER_TX}/${submitResult.txId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2"
                >
                  View group
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function BalanceRow({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub ? (
          <p className={warn ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {sub}
          </p>
        ) : null}
      </div>
      <p className={`font-medium tabular-nums ${warn ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
