import { ArrowDownLeft, ArrowUpRight, Sparkles } from "lucide-react";
import { fmtUSD, friendlyDate, type Transaction } from "@/lib/stash";

export function TransactionRow({ tx }: { tx: Transaction }) {
  const isOut = tx.type === "withdrawal";
  const isInterest = tx.type === "interest";
  const Icon = isOut ? ArrowUpRight : isInterest ? Sparkles : ArrowDownLeft;
  const label =
    tx.type === "deposit" ? "Deposit" : tx.type === "withdrawal" ? "Withdrawal" : "Interest earned";
  const amountStr = `${isOut ? "−" : "+"}${fmtUSD(tx.amount)}`;
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className={
          "grid h-10 w-10 shrink-0 place-items-center rounded-full " +
          (isInterest
            ? "bg-positive/15 text-positive"
            : isOut
              ? "bg-secondary text-foreground"
              : "bg-secondary text-foreground")
        }
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium leading-tight">{label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {tx.note ? `${tx.note} · ` : ""}{friendlyDate(tx.date)}
        </p>
      </div>
      <p
        className={
          "shrink-0 text-[15px] font-semibold tabular-nums " +
          (isInterest ? "text-positive" : isOut ? "text-foreground" : "text-foreground")
        }
      >
        {amountStr}
      </p>
    </div>
  );
}