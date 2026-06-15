export type TxType = "deposit" | "withdrawal" | "interest" | "earn";

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;
  date: string;
  note?: string;
}

export type NewTransaction = {
  type: TxType;
  amount: number;
  note?: string;
  date?: string;
};

const STORAGE_PREFIX = "cash-stash-activity:";

function activityKey(walletAddress: string): string {
  return `${STORAGE_PREFIX}${walletAddress.toLowerCase()}`;
}

export function loadActivity(walletAddress: string | undefined): Transaction[] {
  if (typeof window === "undefined" || !walletAddress) return [];

  try {
    const raw = localStorage.getItem(activityKey(walletAddress));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Transaction[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (tx) =>
          tx &&
          typeof tx.id === "string" &&
          typeof tx.type === "string" &&
          typeof tx.amount === "number" &&
          typeof tx.date === "string",
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch {
    return [];
  }
}

export function saveActivity(walletAddress: string, transactions: Transaction[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(activityKey(walletAddress), JSON.stringify(transactions));
}

export function appendActivity(
  walletAddress: string,
  input: NewTransaction,
): Transaction {
  const tx: Transaction = {
    id: crypto.randomUUID(),
    type: input.type,
    amount: input.amount,
    date: input.date ?? new Date().toISOString(),
    note: input.note,
  };

  const existing = loadActivity(walletAddress);
  const next = [tx, ...existing];
  saveActivity(walletAddress, next);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("cash-stash-activity-updated", {
        detail: { walletAddress: walletAddress.toLowerCase() },
      }),
    );
  }

  return tx;
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
  if (hrs < 24 && d.getDate() === now.getDate()) {
    return `Today, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) {
    return `Yesterday, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  }
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function depositMethodNote(method: string): string {
  switch (method) {
    case "fiat":
      return "Debit card";
    case "external":
      return "Crypto account";
    case "blink":
      return "Blink";
    case "flow":
      return "Any crypto";
    default:
      return "Deposit";
  }
}

export function earnTargetNote(target: "earn_vault" | "dorkfi"): string {
  return target === "earn_vault" ? "Earn vault" : "DorkFi";
}
