import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { MobileShell } from "@/components/BottomNav";
import { TransactionRow } from "@/components/TransactionRow";
import { useActivity } from "@/hooks/useActivity";
import type { TxType } from "@/lib/stash/activity";
import { getUserWalletAddress } from "@/lib/privy/user";

export const Route = createFileRoute("/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Cash Stash" },
      { name: "description", content: "Every deposit, withdrawal, and dollar of interest you've earned." },
      { property: "og:title", content: "Activity — Cash Stash" },
      { property: "og:description", content: "Every deposit, withdrawal, and dollar of interest you've earned." },
    ],
  }),
  component: ActivityPage,
});

type Filter = "all" | TxType;
const filters: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "deposit", label: "Deposits" },
  { id: "earn", label: "Earn" },
  { id: "withdrawal", label: "Withdrawals" },
  { id: "interest", label: "Interest" },
];

const emptyCopy: Record<Filter, string> = {
  all: "No activity yet. Deposits, earn moves, and withdrawals will show up here.",
  deposit: "No deposits yet.",
  earn: "No earn moves yet. Tap Earn on Home when USDC is in your wallet.",
  withdrawal: "No withdrawals yet.",
  interest: "No interest posted yet.",
};

function ActivityPage() {
  const { user } = usePrivy();
  const walletAddress = getUserWalletAddress(user);
  const { transactions } = useActivity(walletAddress);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return transactions;
    return transactions.filter((t) => t.type === filter);
  }, [transactions, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const tx of filtered) {
      const d = new Date(tx.date);
      const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const countLabel =
    filtered.length === 0
      ? "No transactions"
      : filtered.length === 1
        ? "1 transaction"
        : `${filtered.length} transactions`;

  return (
    <MobileShell>
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">History</p>
        <h1 className="font-display mt-1 text-4xl">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">{countLabel}</p>
      </header>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors " +
              (filter === f.id
                ? "bg-foreground text-background"
                : "bg-secondary text-foreground")
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {grouped.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            {emptyCopy[filter]}
          </p>
        )}
        {grouped.map(([month, list]) => (
          <section key={month}>
            <h2 className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {month}
            </h2>
            <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card px-4">
              {list.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </MobileShell>
  );
}
