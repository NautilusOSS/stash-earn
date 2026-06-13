import { Loader2, RefreshCw } from "lucide-react";

import { useWalletUsdcBalance } from "@/hooks/useWalletUsdcBalance";
import { useXChainAddress } from "@/hooks/useXChainAddress";
import { truncateAddress } from "@/lib/privy/constants";
import { fmtUSD } from "@/lib/stash";
import { VOI_USDC_ASSET_ID } from "@/lib/voi/constants";

type UsdcBalanceDebugSectionProps = {
  walletAddress: string | undefined;
};

export function UsdcBalanceDebugSection({ walletAddress }: UsdcBalanceDebugSectionProps) {
  const {
    balance,
    baseBalance,
    executionBalance,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useWalletUsdcBalance(walletAddress);
  const { voiExecutionAddress, isLoading: addressLoading } = useXChainAddress(walletAddress);

  const loading = isLoading || addressLoading;

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">USDC balances</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Base wallet + Voi execution ASA{" "}
            <span className="font-mono text-foreground">{VOI_USDC_ASSET_ID}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={loading || isFetching || !walletAddress}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground disabled:opacity-50"
          aria-label="Refresh USDC balances"
        >
          {isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <BalanceRow
          label="Base USDC"
          sub={walletAddress ? truncateAddress(walletAddress) : undefined}
          value={loading ? "…" : fmtUSD(baseBalance)}
        />
        <BalanceRow
          label="AVM USDC"
          sub={
            voiExecutionAddress
              ? truncateAddress(voiExecutionAddress)
              : addressLoading
                ? "Deriving…"
                : undefined
          }
          value={loading ? "…" : fmtUSD(executionBalance)}
        />
        <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
          <p className="text-xs text-muted-foreground">Total (app balance)</p>
          <p className="text-sm font-semibold tabular-nums">
            {loading ? "…" : fmtUSD(balance)}
          </p>
        </div>
      </div>

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

function BalanceRow({
  label,
  sub,
  value,
}: {
  label: string;
  sub?: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub ? <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{sub}</p> : null}
      </div>
      <p className="shrink-0 text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
