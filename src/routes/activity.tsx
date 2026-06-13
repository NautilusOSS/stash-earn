import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MobileShell } from "@/components/BottomNav";
import { TransactionRow } from "@/components/TransactionRow";
import { useStash, type TxType } from "@/lib/stash";

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
  { id: "withdrawal", label: "Withdrawals" },
  { id: "interest", label: "Interest" },
];

function ActivityPage() {
  const { transactions } = useStash();
  const [filter, setFilter] = useState<Filter>("all");

  const grouped = useMemo(() => {
    const list = filter === "all" ? transactions : transactions.filter((t) => t.type === filter);
    const map = new Map<string, typeof list>();
    for (const tx of list) {
      const d = new Date(tx.date);
      const key = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(tx);
    }
    return Array.from(map.entries());
  }, [transactions, filter]);

  return (
    <MobileShell>
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">History</p>
        <h1 className="font-display mt-1 text-4xl">Activity</h1>
      </header>

      <div className="mt-5 flex gap-2 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.id}
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
          <p className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">
            No transactions yet.
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