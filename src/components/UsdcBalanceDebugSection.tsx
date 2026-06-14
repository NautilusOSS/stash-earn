import { Loader2, RefreshCw } from "lucide-react";

import { useEarnPosition } from "@/hooks/useEarnPosition";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
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
    balance: walletTotal,
    baseBalance,
    executionBalance,
    isLoading: walletLoading,
    isFetching: walletFetching,
    error: walletError,
    refetch: refetchWallet,
  } = useWalletUsdcBalance(walletAddress);
  const {
    configured: earnConfigured,
    assetsInVault,
    earnedYield,
    isLoading: positionLoading,
    isFetching: positionFetching,
    error: positionError,
    refetch: refetchPosition,
  } = useEarnPosition(walletAddress);
  const { details: vaultDetails } = useEarnVaultDetails();
  const { voiExecutionAddress, isLoading: addressLoading } = useXChainAddress(walletAddress);

  const loading = walletLoading || positionLoading || addressLoading;
  const fetching = walletFetching || positionFetching;
  const totalBalance = assetsInVault + walletTotal;
  const earnError = earnConfigured ? positionError : null;

  const refresh = () => {
    void refetchWallet();
    if (earnConfigured) void refetchPosition();
  };

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">USDC balances</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Earn vault + Base wallet + Voi execution ASA{" "}
            <span className="font-mono text-foreground">{VOI_USDC_ASSET_ID}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading || fetching || !walletAddress}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-foreground disabled:opacity-50"
          aria-label="Refresh USDC balances"
        >
          {fetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="mt-3 space-y-2">
        <BalanceRow
          label="Earn vault"
          sub={
            earnConfigured
              ? vaultDetails?.vaultAddress
                ? truncateAddress(vaultDetails.vaultAddress)
                : vaultDetails?.name
              : "Not configured"
          }
          value={loading ? "…" : earnConfigured ? fmtUSD(assetsInVault) : "—"}
          detail={
            earnConfigured && earnedYield > 0 && !loading
              ? `+${fmtUSD(earnedYield)} yield`
              : undefined
          }
        />
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
            {loading ? "…" : fmtUSD(totalBalance)}
          </p>
        </div>
      </div>

      {walletError ? <p className="mt-2 text-sm text-destructive">{walletError}</p> : null}
      {earnError ? <p className="mt-2 text-sm text-destructive">{earnError}</p> : null}
    </div>
  );
}

function BalanceRow({
  label,
  sub,
  value,
  detail,
}: {
  label: string;
  sub?: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub ? <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{sub}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums">{value}</p>
        {detail ? <p className="text-[11px] text-positive tabular-nums">{detail}</p> : null}
      </div>
    </div>
  );
}
