import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AmountKeypad } from "./AmountKeypad";
import { useWalletUsdcBalance } from "@/hooks/useWalletUsdcBalance";
import { useStash, fmtUSD } from "@/lib/stash";
import { Building2, CreditCard, FileText, Check } from "lucide-react";
import { toast } from "sonner";

type Mode = "deposit" | "withdraw";

const depositMethods = [
  { id: "bank", label: "Bank transfer", sub: "Chase ••4421 · Free, 1–2 days", icon: Building2 },
  { id: "card", label: "Debit card", sub: "Instant funding", icon: CreditCard },
  { id: "manual", label: "Manual deposit", sub: "Wire or ACH instructions", icon: FileText },
] as const;

const withdrawDests = [
  { id: "bank", label: "Chase ••4421", sub: "Free, 1–2 business days", icon: Building2 },
  { id: "card", label: "Visa Debit ••8821", sub: "Instant · 1.5% fee", icon: CreditCard },
] as const;

export function MoneySheet({
  mode,
  open,
  onOpenChange,
  walletAddress,
}: {
  mode: Mode;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  walletAddress: string | undefined;
}) {
  const queryClient = useQueryClient();
  const { balance, isLoading: balanceLoading } = useWalletUsdcBalance(walletAddress);
  const { deposit, withdraw } = useStash();
  const [amount, setAmount] = useState("0");
  const [method, setMethod] = useState<string>(mode === "deposit" ? "bank" : "bank");
  const [done, setDone] = useState(false);

  const numeric = Number(amount) || 0;
  const canSubmit = numeric > 0 && (mode === "deposit" || numeric <= balance);

  const reset = () => {
    setAmount("0");
    setDone(false);
    setMethod(mode === "deposit" ? "bank" : "bank");
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    const label =
      mode === "deposit"
        ? depositMethods.find((m) => m.id === method)?.label
        : withdrawDests.find((m) => m.id === method)?.label;
    if (mode === "deposit") {
      deposit(numeric, `From ${label}`);
      toast.success("Your cash has been added to your stash.");
    } else {
      withdraw(numeric, `To ${label}`);
      toast.success("Your withdrawal is on the way.");
    }
    queryClient.invalidateQueries({ queryKey: ["wallet-usdc-balance"] });
    setDone(true);
    setTimeout(() => {
      onOpenChange(false);
      setTimeout(reset, 250);
    }, 1200);
  };

  const title = mode === "deposit" ? "Add to Stash" : "Withdraw";
  const availableLabel = balanceLoading ? "…" : fmtUSD(balance);
  const description =
    mode === "deposit"
      ? "Move money in. Starts earning yield immediately."
      : `Available ${availableLabel}`;

  const options = mode === "deposit" ? depositMethods : withdrawDests;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setTimeout(reset, 250);
      }}
    >
      <SheetContent
        side="bottom"
        className="rounded-t-[2rem] border-t-0 bg-background p-0 sm:max-w-md sm:mx-auto"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" />
        <SheetHeader className="px-6 pt-4 text-left">
          <SheetTitle className="text-xl font-semibold tracking-tight">{title}</SheetTitle>
          <SheetDescription className="text-muted-foreground">{description}</SheetDescription>
        </SheetHeader>

        {done ? (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-positive/15 text-positive">
              <Check className="h-7 w-7" strokeWidth={2.25} />
            </div>
            <p className="font-display text-2xl">
              {mode === "deposit" ? "Added to your stash." : "On the way."}
            </p>
            <p className="text-sm text-muted-foreground">
              {mode === "deposit"
                ? "Your balance is updated and earning yield."
                : "Funds will arrive in 1–2 business days."}
            </p>
          </div>
        ) : (
          <div className="px-6 pb-6">
            <div className="py-8 text-center">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {mode === "deposit" ? "Deposit amount" : "Withdraw amount"}
              </p>
              <p className="font-display mt-2 text-6xl tabular-nums leading-none text-foreground">
                <span className="text-muted-foreground/60">$</span>
                {amount}
              </p>
              {mode === "withdraw" && numeric > balance && (
                <p className="mt-2 text-xs text-destructive">Exceeds available balance.</p>
              )}
            </div>

            <AmountKeypad value={amount} onChange={setAmount} />

            <div className="mt-6 space-y-2">
              <p className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                {mode === "deposit" ? "From" : "To"}
              </p>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {options.map((o, i) => {
                  const Icon = o.icon;
                  const active = method === o.id;
                  return (
                    <button
                      key={o.id}
                      onClick={() => setMethod(o.id)}
                      className={
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors " +
                        (i > 0 ? "border-t border-border " : "") +
                        (active ? "bg-secondary/60" : "bg-transparent")
                      }
                    >
                      <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground">
                        <Icon className="h-4 w-4" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{o.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{o.sub}</p>
                      </div>
                      <span
                        className={
                          "h-4 w-4 rounded-full border " +
                          (active ? "border-foreground bg-foreground" : "border-border")
                        }
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              size="lg"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="mt-6 h-14 w-full rounded-2xl text-base font-semibold"
            >
              {mode === "deposit"
                ? `Add ${numeric > 0 ? fmtUSD(numeric) : ""}`.trim()
                : `Withdraw ${numeric > 0 ? fmtUSD(numeric) : ""}`.trim()}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}