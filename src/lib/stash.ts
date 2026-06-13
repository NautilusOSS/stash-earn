import { create } from "zustand";

export type TxType = "deposit" | "withdrawal" | "interest";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number; // positive number; sign derived from type
  date: string; // ISO
  note?: string;
}

interface StashState {
  balance: number;
  apy: number; // 0.0487 = 4.87%
  transactions: Transaction[];
  deposit: (amount: number, note?: string) => void;
  withdraw: (amount: number, note?: string) => void;
}

const seed: Transaction[] = [
  { id: "t1", type: "interest", amount: 0.34, date: daysAgo(0), note: "Daily interest" },
  { id: "t2", type: "deposit", amount: 500, date: daysAgo(2), note: "From Chase ••4421" },
  { id: "t3", type: "interest", amount: 0.31, date: daysAgo(3), note: "Daily interest" },
  { id: "t4", type: "withdrawal", amount: 125, date: daysAgo(6), note: "To Chase ••4421" },
  { id: "t5", type: "interest", amount: 0.29, date: daysAgo(8), note: "Daily interest" },
  { id: "t6", type: "deposit", amount: 1000, date: daysAgo(12), note: "From Chase ••4421" },
  { id: "t7", type: "deposit", amount: 1200, date: daysAgo(28), note: "Opening deposit" },
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(9 - n, 14 + n, 0, 0);
  return d.toISOString();
}

export const useStash = create<StashState>((set) => ({
  balance: 2548.12,
  apy: 0.0487,
  transactions: seed,
  deposit: (amount, note) =>
    set((s) => ({
      balance: round(s.balance + amount),
      transactions: [
        { id: crypto.randomUUID(), type: "deposit", amount, date: new Date().toISOString(), note: note ?? "Bank transfer" },
        ...s.transactions,
      ],
    })),
  withdraw: (amount, note) =>
    set((s) => ({
      balance: round(Math.max(0, s.balance - amount)),
      transactions: [
        { id: crypto.randomUUID(), type: "withdrawal", amount, date: new Date().toISOString(), note: note ?? "To linked bank" },
        ...s.transactions,
      ],
    })),
}));

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export const fmtUSD = (n: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  }).format(n);

export function friendlyDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24 && d.getDate() === now.getDate()) return `Today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
