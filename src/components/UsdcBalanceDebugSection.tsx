import { Loader2, RefreshCw } from "lucide-react";

import { useCompositeYield } from "@/hooks/useCompositeYield";
import { useDorkFiSupplyApy } from "@/hooks/useDorkFiSupplyApy";
import { useDorkFiUsdcPosition } from "@/hooks/useDorkFiUsdcPosition";
import { useEarnPosition } from "@/hooks/useEarnPosition";
import { useEarnVaultApys } from "@/hooks/useEarnVaultApys";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import { useWalletUsdcBalance } from "@/hooks/useWalletUsdcBalance";
import { useXChainAddress } from "@/hooks/useXChainAddress";
import { VOI_MAINNET_A_MARKET_USDC } from "@/lib/dorkfi/constants";
import { truncateAddress } from "@/lib/privy/constants";
import { fmtUSD } from "@/lib/stash";
import { VOI_USDC_ASSET_ID } from "@/lib/voi/constants";

type UsdcBalanceDebugSectionProps = {
  walletAddress: string | undefined;
};

export function UsdcBalanceDebugSection({ walletAddress }: UsdcBalanceDebugSectionProps) {
  const {
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
    vaultPositions,
    isLoading: positionLoading,
    isFetching: positionFetching,
    error: positionError,
    refetch: refetchPosition,
  } = useEarnPosition(walletAddress);
  const { apyLabels, isLoading: vaultApyLoading } = useEarnVaultApys();
  const {
    refetch: refetchVaultDetails,
  } = useEarnVaultDetails();
  const { voiExecutionAddress, isLoading: addressLoading } = useXChainAddress(walletAddress);
  const {
    balance: dorkFiBalance,
    isLoading: dorkFiLoading,
    isFetching: dorkFiFetching,
    error: dorkFiError,
    refetch: refetchDorkFi,
  } = useDorkFiUsdcPosition(walletAddress);
  const {
    supplyApyLabel,
    isLoading: apyLoading,
    isFetching: apyFetching,
    refetch: refetchApy,
  } = useDorkFiSupplyApy();

  const {
    totalBalance,
    compositeYieldDetail,
    apyLoading: compositeApyLoading,
  } = useCompositeYield(walletAddress);

  const loading = walletLoading || positionLoading || addressLoading || dorkFiLoading;
  const fetching = walletFetching || positionFetching || dorkFiFetching || apyFetching;
  const earnError = earnConfigured ? positionError : null;

  const refresh = () => {
    void refetchWallet();
    void refetchDorkFi();
    void refetchApy();
    if (earnConfigured) {
      void refetchPosition();
      void refetchVaultDetails();
    }
  };

  return (
    <div className="px-4 py-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">USDC balances</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Earn vaults, DorkFi supply, Base wallet, and Voi execution ASA{" "}
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
          label="Earn vaults (total)"
          value={loading ? "…" : earnConfigured ? fmtUSD(assetsInVault) : "—"}
          detail={earnVaultDetail({
            configured: earnConfigured,
            loading,
            apyLoading: vaultApyLoading,
            apyLabel: null,
            earnedYield,
          })}
          valueClassName={vaultPositions.length > 1 ? "font-semibold" : undefined}
        />
        {earnConfigured
          ? vaultPositions.map((vault) => (
              <BalanceRow
                key={vault.vaultId}
                label={vault.vaultName}
                value={loading ? "…" : fmtUSD(vault.assetsInVault)}
                detail={
                  vaultApyLoading
                    ? "Loading APY…"
                    : apyLabels[vault.vaultId as keyof typeof apyLabels]
                      ? `${apyLabels[vault.vaultId as keyof typeof apyLabels]} APY`
                      : undefined
                }
              />
            ))
          : (
              <BalanceRow
                label="Earn vaults"
                sub="Not configured"
                value="—"
              />
            )}
        <BalanceRow
          label="AVM DorkFi USDC"
          sub={`${VOI_MAINNET_A_MARKET_USDC.symbol} · pool ${VOI_MAINNET_A_MARKET_USDC.poolId}`}
          value={loading ? "…" : fmtUSD(dorkFiBalance)}
          detail={
            apyLoading
              ? "Loading APY…"
              : supplyApyLabel
                ? `${supplyApyLabel} APY`
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
        <BalanceRow
          label="Total (app balance)"
          value={loading ? "…" : fmtUSD(totalBalance)}
          detail={
            compositeApyLoading
              ? "Loading composite yield…"
              : compositeYieldDetail ?? undefined
          }
          valueClassName="font-semibold"
        />
      </div>

      {walletError ? <p className="mt-2 text-sm text-destructive">{walletError}</p> : null}
      {dorkFiError ? <p className="mt-2 text-sm text-destructive">{dorkFiError}</p> : null}
      {earnError ? <p className="mt-2 text-sm text-destructive">{earnError}</p> : null}
    </div>
  );
}

function earnVaultDetail(input: {
  configured: boolean;
  loading: boolean;
  apyLoading: boolean;
  apyLabel: string | null;
  earnedYield: number;
}): string | undefined {
  if (!input.configured) return undefined;
  if (input.apyLoading) return "Loading APY…";

  const parts: string[] = [];
  if (input.apyLabel) parts.push(`${input.apyLabel} APY`);
  if (input.earnedYield > 0 && !input.loading) {
    parts.push(`+${fmtUSD(input.earnedYield)} yield`);
  }
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function BalanceRow({
  label,
  sub,
  value,
  detail,
  valueClassName,
}: {
  label: string;
  sub?: string;
  value: string;
  detail?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {sub ? <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{sub}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-medium tabular-nums ${valueClassName ?? ""}`}>{value}</p>
        {detail ? <p className="text-[11px] text-positive tabular-nums">{detail}</p> : null}
      </div>
    </div>
  );
}
