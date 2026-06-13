import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AmountKeypad } from "./AmountKeypad";
import { useEarnPosition } from "@/hooks/useEarnPosition";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import { useEarnWithdraw } from "@/hooks/useEarnWithdraw";
import { useStashDeposit, type StashDepositMethod } from "@/hooks/useStashDeposit";
import { fmtUSD } from "@/lib/stash";
import { CreditCard, Wallet, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Mode = "deposit" | "withdraw";

const depositMethods = [
  {
    id: "fiat" as const,
    label: "Debit card",
    sub: "Buy USDC with card · Apple Pay · Google Pay",
    icon: CreditCard,
  },
  {
    id: "external" as const,
    label: "Crypto account",
    sub: "Transfer USDC from MetaMask, Coinbase, etc.",
    icon: Wallet,
  },
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
  const { configured, isLoading: earnLoading } = useEarnVaultDetails();
  const { assetsInVault, isLoading: positionLoading } = useEarnPosition(walletAddress);
  const { deposit, isSubmitting: isDepositing, error: depositError } = useStashDeposit(walletAddress);
  const { withdraw, isSubmitting: isWithdrawing, error: withdrawError } = useEarnWithdraw(walletAddress);

  const [amount, setAmount] = useState("0");
  const [depositMethod, setDepositMethod] = useState<StashDepositMethod>("fiat");
  const [done, setDone] = useState(false);

  const numeric = Number(amount) || 0;
  const maxWithdraw = assetsInVault;
  const balanceLoading = positionLoading;
  const isSubmitting = mode === "deposit" ? isDepositing : isWithdrawing;
  const submitError = mode === "deposit" ? depositError : withdrawError;
  const canSubmit =
    mode === "deposit"
      ? numeric > 0 && !isSubmitting
      : configured &&
        numeric > 0 &&
        numeric <= maxWithdraw &&
        !isSubmitting &&
        !balanceLoading;

  const reset = () => {
    setAmount("0");
    setDone(false);
    setDepositMethod("fiat");
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;

    if (mode === "deposit") {
      const ok = await deposit(numeric, depositMethod);
      if (!ok) return;
      toast.success("Your deposit is in progress.");
    } else {
      const action = await withdraw(numeric);
      if (!action) return;
      toast.success("Withdrawal sent to your wallet.");
    }

    setDone(true);
    setTimeout(() => {
      onOpenChange(false);
      setTimeout(reset, 250);
    }, 1200);
  };

  const title = mode === "deposit" ? "Add to Stash" : "Withdraw";
  const availableLabel = balanceLoading ? "…" : fmtUSD(maxWithdraw);
  const description =
    mode === "deposit"
      ? "Fund with a debit card or crypto account. Starts earning yield when USDC arrives."
      : `Available ${availableLabel}`;

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

        {mode === "withdraw" && earnLoading ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading…
          </div>
        ) : mode === "withdraw" && !configured ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            <p>Withdrawals are not available yet.</p>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-positive/15 text-positive">
              <Check className="h-7 w-7" strokeWidth={2.25} />
            </div>
            <p className="font-display text-2xl">
              {mode === "deposit" ? "Deposit started." : "Sent to your wallet."}
            </p>
            <p className="text-sm text-muted-foreground">
              {mode === "deposit"
                ? "USDC may take a few minutes to arrive and start earning."
                : "USDC will appear in your wallet shortly."}
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
              {mode === "withdraw" && numeric > maxWithdraw && (
                <p className="mt-2 text-xs text-destructive">Exceeds available balance.</p>
              )}
              {submitError && (
                <p className="mt-2 text-xs text-destructive">{submitError}</p>
              )}
            </div>

            <AmountKeypad value={amount} onChange={setAmount} />

            {mode === "deposit" ? (
              <div className="mt-6 space-y-2">
                <p className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  From
                </p>
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  {depositMethods.map((option, index) => {
                    const Icon = option.icon;
                    const active = depositMethod === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setDepositMethod(option.id)}
                        className={
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors " +
                          (index > 0 ? "border-t border-border " : "") +
                          (active ? "bg-secondary/60" : "bg-transparent")
                        }
                      >
                        <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground">
                          <Icon className="h-4 w-4" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{option.label}</p>
                          <p className="truncate text-xs text-muted-foreground">{option.sub}</p>
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
            ) : null}

            <Button
              size="lg"
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
              className="mt-6 h-14 w-full rounded-2xl text-base font-semibold"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {mode === "deposit" ? "Starting deposit…" : "Withdrawing…"}
                </span>
              ) : mode === "deposit" ? (
                `Add ${numeric > 0 ? fmtUSD(numeric) : ""}`.trim()
              ) : (
                `Withdraw ${numeric > 0 ? fmtUSD(numeric) : ""}`.trim()
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
