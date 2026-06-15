import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Sparkles, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { usePrivy } from "@privy-io/react-auth";
import { MobileShell } from "@/components/BottomNav";
import { MoneySheet } from "@/components/MoneySheet";
import { TransactionRow } from "@/components/TransactionRow";
import { useCompositeYield } from "@/hooks/useCompositeYield";
import { useAutoEarn } from "@/hooks/useAutoEarn";
import { useWalletUsdcBalance } from "@/hooks/useWalletUsdcBalance";
import { useStash, fmtUSD } from "@/lib/stash";
import { getTimeBasedGreeting, getPreferredName } from "@/lib/privy/profile";
import { getUserAvatar, getUserWalletAddress } from "@/lib/privy/user";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cash Stash — Earn yield on your cash" },
      {
        name: "description",
        content: "Your stash, earning every day. Simple deposits, simple withdrawals.",
      },
      { property: "og:title", content: "Cash Stash" },
      { property: "og:description", content: "A simple place to keep cash and earn yield." },
    ],
  }),
  component: Home,
});

function Home() {
  const { user } = usePrivy();
  const { apy: fallbackApy, transactions } = useStash();
  const walletAddress = getUserWalletAddress(user);
  const { baseBalance, isLoading: walletLoading } = useWalletUsdcBalance(walletAddress);
  const { applyAutoEarn, resolvedTarget } = useAutoEarn(walletAddress);
  const {
    totalBalance,
    earningBalance,
    compositeApyLabel,
    estimatedAnnualYield,
    estimatedDailyYield,
    apyLoading,
    isLoading: compositeLoading,
  } = useCompositeYield(walletAddress);
  const [sheet, setSheet] = useState<null | "deposit" | "withdraw">(null);
  const [isEarning, setIsEarning] = useState(false);

  const preferredName = getPreferredName(user) ?? "there";
  const avatar = getUserAvatar(user);
  const greeting = getTimeBasedGreeting();

  const balanceLoading = walletLoading || compositeLoading;
  const apyDisplay = apyLoading ? "…" : compositeApyLabel ?? `${(fallbackApy * 100).toFixed(2)}%`;
  const annualLabel =
    estimatedAnnualYield == null ? "—" : fmtUSD(estimatedAnnualYield);

  const balanceLabel = balanceLoading ? "—" : fmtUSD(totalBalance).replace("$", "");
  const [dollars, cents] = balanceLabel.includes(".")
    ? balanceLabel.split(".")
    : [balanceLabel, "00"];
  const recent = transactions.slice(0, 4);
  const canEarnFromWallet = baseBalance > 0 && resolvedTarget != null;

  const handleEarn = async () => {
    if (!canEarnFromWallet || isEarning) return;
    setIsEarning(true);
    try {
      await applyAutoEarn(baseBalance, { notify: true });
    } finally {
      setIsEarning(false);
    }
  };

  return (
    <MobileShell>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cash Stash</p>
          <h1 className="mt-0.5 text-base font-medium">
            {avatar ? <span className="mr-1.5">{avatar}</span> : null}
            {greeting}, {preferredName}
          </h1>
        </div>
        <Link
          to="/account"
          className="grid h-10 w-10 place-items-center rounded-full bg-secondary text-sm font-semibold text-foreground"
        >
          {avatar ?? preferredName.slice(0, 2).toUpperCase()}
        </Link>
      </header>

      {/* Hero card */}
      <section className="mt-6 overflow-hidden rounded-[2rem] bg-primary p-6 text-primary-foreground shadow-[0_30px_60px_-30px_rgba(0,0,0,0.35)]">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.18em] text-primary-foreground/70">
            Total balance
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-positive/20 px-2.5 py-1 text-[11px] font-semibold text-positive">
            <Sparkles className="h-3 w-3" strokeWidth={2.25} />
            {apyDisplay} APY
          </span>
        </div>

        <p className="font-display mt-3 text-[64px] leading-none tabular-nums">
          <span className="text-primary-foreground/60">$</span>
          {dollars}
          <span className="text-primary-foreground/60">.{cents}</span>
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-primary-foreground/10 pt-5">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary-foreground/60">
              Earning
            </p>
            <p className="mt-1 text-base font-semibold">{fmtUSD(earningBalance)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary-foreground/60">
              Est yield 1y
            </p>
            <p className="mt-1 text-base font-semibold text-positive">
              {balanceLoading || apyLoading
                ? "—"
                : estimatedAnnualYield == null
                  ? "+$0"
                  : `+${annualLabel}`}
            </p>
          </div>
        </div>
        {canEarnFromWallet && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-primary-foreground/10 pt-4">
            <p className="text-xs text-primary-foreground/60">
              {fmtUSD(baseBalance)} in wallet ready to earn
            </p>
            <button
              type="button"
              onClick={() => void handleEarn()}
              disabled={isEarning || walletLoading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-foreground px-4 py-1.5 text-xs font-semibold text-primary transition-opacity disabled:opacity-60"
            >
              {isEarning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Earning…
                </>
              ) : (
                "Earn"
              )}
            </button>
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          onClick={() => setSheet("deposit")}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl bg-foreground text-base font-semibold text-background transition-transform active:scale-[0.98]"
        >
          <ArrowDownToLine className="h-5 w-5" strokeWidth={2} />
          Deposit
        </button>
        <button
          onClick={() => setSheet("withdraw")}
          className="flex h-16 items-center justify-center gap-2 rounded-2xl border border-border bg-card text-base font-semibold text-foreground transition-transform active:scale-[0.98]"
        >
          <ArrowUpFromLine className="h-5 w-5" strokeWidth={2} />
          Withdraw
        </button>
      </div>

      {/* Earnings insight */}
      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-positive/15 text-positive">
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          </div>
          <div>
            <p className="text-[15px] font-medium">
              {earningBalance > 0 && estimatedDailyYield != null
                ? `You could earn about ${fmtUSD(estimatedDailyYield)} today.`
                : earningBalance > 0 && apyLoading
                  ? "Loading yield estimate…"
                  : earningBalance > 0
                    ? "Yield estimate unavailable."
                    : "Deposit USDC to start earning."}
            </p>
            <p className="text-xs text-muted-foreground">
              {estimatedAnnualYield != null ? (
                <>
                  At {apyDisplay} APY, {fmtUSD(totalBalance)} earns about {annualLabel} a year.
                </>
              ) : (
                <>Composite yield uses your total balance and Earn + DorkFi APY weights.</>
              )}
            </p>
          </div>
        </div>
      </section>

      {/* Activity */}
      <section className="mt-7">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Recent activity
          </h2>
          <Link
            to="/activity"
            className="inline-flex items-center gap-0.5 text-sm font-medium text-foreground"
          >
            See all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card px-4">
          {recent.map((tx) => (
            <TransactionRow key={tx.id} tx={tx} />
          ))}
        </div>
      </section>

      <MoneySheet
        mode={sheet ?? "deposit"}
        open={sheet !== null}
        onOpenChange={(o) => !o && setSheet(null)}
        walletAddress={walletAddress}
      />
    </MobileShell>
  );
}
