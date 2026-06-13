import { lazy, Suspense, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AmountKeypad } from "./AmountKeypad";
import { useBlinkConfigured } from "@/hooks/useBlinkConfigured";
import { useEarnPosition } from "@/hooks/useEarnPosition";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import { useEarnWithdraw } from "@/hooks/useEarnWithdraw";
import { useStashDeposit, type StashDepositMethod } from "@/hooks/useStashDeposit";
import { fmtUSD } from "@/lib/stash";
import { CreditCard, Wallet, Zap, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BlinkDepositPanel = lazy(() =>
  import("./BlinkDepositPanel").then((m) => ({ default: m.BlinkDepositPanel })),
);

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
  {
    id: "blink" as const,
    label: "Blink",
    sub: "Deposit USDC with passkey · wallets Blink supports",
    icon: Zap,
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
  const { configured: blinkConfigured } = useBlinkConfigured();
  const { withdraw, isSubmitting: isWithdrawing, error: withdrawError } = useEarnWithdraw(walletAddress);

  const [amount, setAmount] = useState("0");
  const [depositMethod, setDepositMethod] = useState<StashDepositMethod | "blink">("fiat");
  const [done, setDone] = useState(false);
  const [blinkError, setBlinkError] = useState<string | null>(null);

  const numeric = Number(amount) || 0;
  const maxWithdraw = assetsInVault;
  const balanceLoading = positionLoading;
  const isBlinkDeposit = mode === "deposit" && depositMethod === "blink";
  const isSubmitting = mode === "deposit" ? isDepositing : isWithdrawing;
  const submitError =
    mode === "deposit"
      ? isBlinkDeposit
        ? blinkError
        : depositError
      : withdrawError;
  const canSubmitPrivy = numeric > 0 && !isDepositing && depositMethod !== "blink";
  const canSubmitWithdraw =
    configured &&
    numeric > 0 &&
    numeric <= maxWithdraw &&
    !isWithdrawing &&
    !balanceLoading;

  const reset = () => {
    setAmount("0");
    setDone(false);
    setDepositMethod("fiat");
    setBlinkError(null);
  };

  const finishSuccess = () => {
    setDone(true);
    setTimeout(() => {
      onOpenChange(false);
      setTimeout(reset, 250);
    }, 1200);
  };

  const handlePrivySubmit = async () => {
    if (!canSubmitPrivy || depositMethod === "blink") return;

    const ok = await deposit(numeric, depositMethod);
    if (!ok) return;
    toast.success("Your deposit is in progress.");
    finishSuccess();
  };

  const handleBlinkSuccess = () => {
    toast.success("Blink deposit complete. Moving USDC into yield when it lands…");
    finishSuccess();
  };

  const handleWithdrawSubmit = async () => {
    if (!canSubmitWithdraw) return;

    const action = await withdraw(numeric);
    if (!action) return;
    toast.success("Withdrawal sent to your wallet.");
    finishSuccess();
  };

  const title = mode === "deposit" ? "Add to Stash" : "Withdraw";
  const availableLabel = balanceLoading ? "…" : fmtUSD(maxWithdraw);
  const description =
    mode === "deposit"
      ? "Debit card, crypto account, or Blink. Starts earning yield when USDC arrives."
      : `Available ${availableLabel}`;

  // Blink mounts its iframe on document.body. Radix modal dialogs call hideOthers()
  // on siblings, which breaks WebAuthn passkey create/get inside the Blink iframe.
  const sheetModal = !isBlinkDeposit;

  return (
    <Sheet
      open={open}
      modal={sheetModal}
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
                    if (option.id === "blink" && !blinkConfigured) return null;

                    const Icon = option.icon;
                    const active = depositMethod === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setDepositMethod(option.id);
                          setBlinkError(null);
                        }}
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

            {mode === "deposit" && isBlinkDeposit ? (
              <div className="mt-6">
                <Suspense
                  fallback={
                    <div className="flex h-14 items-center justify-center rounded-2xl bg-secondary/40">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <BlinkDepositPanel
                    walletAddress={walletAddress}
                    amount={numeric}
                    onSuccess={handleBlinkSuccess}
                    onErrorMessage={setBlinkError}
                  />
                </Suspense>
              </div>
            ) : (
              <Button
                size="lg"
                disabled={mode === "deposit" ? !canSubmitPrivy : !canSubmitWithdraw}
                onClick={() =>
                  mode === "deposit" ? void handlePrivySubmit() : void handleWithdrawSubmit()
                }
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
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
