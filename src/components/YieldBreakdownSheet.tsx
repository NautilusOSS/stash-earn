import { Loader2 } from "lucide-react";

import { useCompositeYield } from "@/hooks/useCompositeYield";
import { useDorkFiSupplyApy } from "@/hooks/useDorkFiSupplyApy";
import { useDorkFiUsdcPosition } from "@/hooks/useDorkFiUsdcPosition";
import { useEarnPosition } from "@/hooks/useEarnPosition";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import { useWalletUsdcBalance } from "@/hooks/useWalletUsdcBalance";
import { fmtUSD } from "@/lib/stash";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

type YieldBreakdownSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string | undefined;
};

function formatShare(balance: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((balance / total) * 100).toFixed(0)}% of stash`;
}

function formatApyContribution(
  balance: number,
  apyDecimal: number | null,
  total: number,
): string | null {
  if (total <= 0 || balance <= 0 || apyDecimal == null) return null;
  const contribution = ((balance * apyDecimal) / total) * 100;
  return `+${contribution.toFixed(2)}% to composite`;
}

function BreakdownRow({
  label,
  balance,
  apyLabel,
  shareLabel,
  contributionLabel,
  loading,
}: {
  label: string;
  balance: number;
  apyLabel: string | null;
  shareLabel: string;
  contributionLabel: string | null;
  loading: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{shareLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold tabular-nums">
            {loading ? "…" : fmtUSD(balance)}
          </p>
          {apyLabel ? (
            <p className="text-xs text-positive tabular-nums">{apyLabel} APY</p>
          ) : (
            <p className="text-xs text-muted-foreground">0% APY</p>
          )}
        </div>
      </div>
      {contributionLabel ? (
        <p className="mt-2 text-[11px] text-muted-foreground">{contributionLabel}</p>
      ) : null}
    </div>
  );
}

export function YieldBreakdownSheet({
  open,
  onOpenChange,
  walletAddress,
}: YieldBreakdownSheetProps) {
  const { balance: walletTotal, isLoading: walletLoading } = useWalletUsdcBalance(walletAddress);
  const {
    assetsInVault,
    isLoading: positionLoading,
  } = useEarnPosition(walletAddress);
  const {
    configured: earnConfigured,
    userApyLabel,
    userApyDecimal,
    isLoading: vaultDetailsLoading,
  } = useEarnVaultDetails();
  const {
    balance: dorkFiBalance,
    isLoading: dorkFiLoading,
  } = useDorkFiUsdcPosition(walletAddress);
  const { supplyApyLabel, supplyApyDecimal, isLoading: dorkFiApyLoading } = useDorkFiSupplyApy();
  const {
    totalBalance,
    earningBalance,
    compositeApyLabel,
    estimatedAnnualYield,
    estimatedDailyYield,
    apyLoading,
    isLoading: compositeLoading,
  } = useCompositeYield(walletAddress);

  const earnBalance = earnConfigured ? assetsInVault : 0;
  const idleBalance = Math.max(0, walletTotal);
  const loading =
    walletLoading || positionLoading || dorkFiLoading || compositeLoading || apyLoading;

  const earnApyLabel = earnConfigured ? userApyLabel : null;
  const earnApyDecimal = earnConfigured ? userApyDecimal : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92dvh] overflow-y-auto rounded-t-[2rem] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Yield breakdown</SheetTitle>
          <SheetDescription>
            Composite yield blends every dollar in your stash. Earn vault and DorkFi balances earn
            at their live APYs; USDC in your wallet counts at 0% until you move it into yield.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading yield breakdown…
            </div>
          ) : totalBalance <= 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Deposit USDC to see how your yield is calculated.
            </p>
          ) : (
            <>
              {earnConfigured && (
                <BreakdownRow
                  label="Earn vault"
                  balance={earnBalance}
                  apyLabel={vaultDetailsLoading ? null : earnApyLabel}
                  shareLabel={formatShare(earnBalance, totalBalance)}
                  contributionLabel={formatApyContribution(
                    earnBalance,
                    earnApyDecimal,
                    totalBalance,
                  )}
                  loading={positionLoading || vaultDetailsLoading}
                />
              )}
              <BreakdownRow
                label="DorkFi"
                balance={dorkFiBalance}
                apyLabel={dorkFiApyLoading ? null : supplyApyLabel}
                shareLabel={formatShare(dorkFiBalance, totalBalance)}
                contributionLabel={formatApyContribution(
                  dorkFiBalance,
                  supplyApyDecimal,
                  totalBalance,
                )}
                loading={dorkFiLoading || dorkFiApyLoading}
              />
              <BreakdownRow
                label="Wallet"
                balance={idleBalance}
                apyLabel={null}
                shareLabel={formatShare(idleBalance, totalBalance)}
                contributionLabel={idleBalance > 0 ? "+0.00% to composite" : null}
                loading={walletLoading}
              />

              <div className="rounded-2xl border border-border bg-secondary/40 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Composite yield
                </p>
                <p className="mt-2 font-display text-3xl tabular-nums text-positive">
                  {compositeApyLabel ?? "—"}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {fmtUSD(earningBalance)} earning now · {fmtUSD(totalBalance)} total balance
                </p>
                {estimatedDailyYield != null && estimatedAnnualYield != null ? (
                  <p className="mt-2 text-sm text-foreground">
                    About {fmtUSD(estimatedDailyYield)} per day · {fmtUSD(estimatedAnnualYield)} per
                    year at this rate.
                  </p>
                ) : null}
              </div>

              <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                Formula: (Earn vault × Earn APY + DorkFi × DorkFi APY) ÷ total balance. Wallet USDC
                is included in total balance but earns 0% until swept into yield.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
