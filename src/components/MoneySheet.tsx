import { lazy, Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AmountKeypad } from "./AmountKeypad";
import { useBlinkConfigured } from "@/hooks/useBlinkConfigured";
import { useDynamicConfigured } from "@/hooks/useDynamicConfigured";
import { useWithdrawableBalance } from "@/hooks/useWithdrawableBalance";
import { useEarnWithdraw } from "@/hooks/useEarnWithdraw";
import { useStashDeposit, type StashDepositMethod } from "@/hooks/useStashDeposit";
import { fmtUSD } from "@/lib/stash";
import { atomicToUsdc } from "@/lib/privy/earn-amount";
import { truncateAddress } from "@/lib/privy/constants";
import { getWithdrawAddress } from "@/lib/privy/profile";
import { usePrivy } from "@privy-io/react-auth";
import { CreditCard, Wallet, Zap, Check, Loader2, Coins } from "lucide-react";
import { toast } from "sonner";

const BlinkDepositPanel = lazy(() =>
  import("./BlinkDepositPanel").then((m) => ({ default: m.BlinkDepositPanel })),
);

const DynamicFlowDepositPanel = lazy(() =>
  import("./DynamicFlowDepositPanel").then((m) => ({ default: m.DynamicFlowDepositPanel })),
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
    id: "flow" as const,
    label: "Any crypto",
    sub: "ETH, USDC, or any token · settles as USDC on Base",
    icon: Coins,
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
  const { user } = usePrivy();
  const withdrawAddress = getWithdrawAddress(user);
  const {
    total: totalBalance,
    executableTotal: maxWithdraw,
    executableAtomic,
    walletBalance,
    vaultBalance,
    voiBalance,
    hasBalance,
    canWithdrawNow,
    isLoading: balanceLoading,
  } = useWithdrawableBalance(walletAddress);
  const { deposit, isSubmitting: isDepositing, error: depositError } = useStashDeposit(walletAddress);
  const { configured: blinkConfigured } = useBlinkConfigured();
  const { configured: flowConfigured } = useDynamicConfigured();
  const {
    withdraw,
    isSubmitting: isWithdrawing,
    error: withdrawError,
    withdrawAddressConfigured,
  } = useEarnWithdraw(walletAddress);

  const [amount, setAmount] = useState("0");
  const [depositMethod, setDepositMethod] = useState<StashDepositMethod | "blink" | "flow">("fiat");
  const [withdrawRawAmount, setWithdrawRawAmount] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [blinkError, setBlinkError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  const numeric = Number(amount) || 0;
  const isBlinkDeposit = mode === "deposit" && depositMethod === "blink";
  const isFlowDeposit = mode === "deposit" && depositMethod === "flow";
  const isSubmitting = mode === "deposit" ? isDepositing : isWithdrawing;
  const submitError =
    mode === "deposit"
      ? isBlinkDeposit
        ? blinkError
        : isFlowDeposit
          ? flowError
          : depositError
      : withdrawError;
  const canSubmitPrivy =
    numeric > 0 && !isDepositing && depositMethod !== "blink" && depositMethod !== "flow";
  const canSubmitWithdraw =
    withdrawAddressConfigured &&
    canWithdrawNow &&
    numeric > 0 &&
    numeric <= maxWithdraw &&
    !isWithdrawing &&
    !balanceLoading;

  const reset = () => {
    setAmount("0");
    setWithdrawRawAmount(null);
    setDone(false);
    setDepositMethod("fiat");
    setBlinkError(null);
    setFlowError(null);
  };

  const finishSuccess = () => {
    setDone(true);
    setTimeout(() => {
      onOpenChange(false);
      setTimeout(reset, 250);
    }, 1200);
  };

  const handlePrivySubmit = async () => {
    if (!canSubmitPrivy) return;

    const ok = await deposit(numeric, depositMethod);
    if (!ok) return;
    toast.success("Your deposit is in progress.");
    finishSuccess();
  };

  const handleBlinkSuccess = () => {
    toast.success("Blink deposit complete. Moving USDC into yield when it lands…");
    finishSuccess();
  };

  const handleFlowSuccess = () => {
    toast.success("Deposit complete. Moving USDC into yield when it lands…");
    finishSuccess();
  };

  const handleWithdrawSubmit = async () => {
    if (!canSubmitWithdraw) return;

    const result = await withdraw(
      numeric,
      withdrawRawAmount && BigInt(withdrawRawAmount) > 0n ? withdrawRawAmount : undefined,
    );
    if (!result) return;
    toast.success(`Withdrawal sent to ${truncateAddress(result.destinationAddress)} on Base.`);
    finishSuccess();
  };

  const handleAmountChange = (next: string) => {
    setAmount(next);
    setWithdrawRawAmount(null);
  };

  const handleWithdrawMax = () => {
    if (!canWithdrawNow || executableAtomic === "0") return;
    const maxDisplay = atomicToUsdc(executableAtomic).toFixed(2);
    setAmount(maxDisplay);
    setWithdrawRawAmount(executableAtomic);
  };

  const title = mode === "deposit" ? "Add to Stash" : "Withdraw";
  const availableLabel = balanceLoading ? "…" : fmtUSD(totalBalance);
  const withdrawableLabel = balanceLoading ? "…" : fmtUSD(maxWithdraw);
  const breakdownParts = [
    walletBalance > 0 ? `${fmtUSD(walletBalance)} wallet` : null,
    vaultBalance > 0 ? `${fmtUSD(vaultBalance)} vault` : null,
    voiBalance > 0 ? `${fmtUSD(voiBalance)} Voi` : null,
  ].filter(Boolean);
  const description =
    mode === "deposit"
      ? "Debit card, crypto account, any crypto, or Blink. Starts earning yield when USDC arrives."
      : withdrawAddressConfigured
        ? voiBalance > 0 && maxWithdraw < totalBalance
          ? `${fmtUSD(totalBalance)} total · ${withdrawableLabel} withdrawable now · ${truncateAddress(withdrawAddress!)}`
          : `Available ${availableLabel} · sends to ${truncateAddress(withdrawAddress!)} on Base`
        : `Available ${availableLabel}`;

  // Blink mounts its iframe on document.body. Radix modal dialogs call hideOthers()
  // on siblings, which breaks WebAuthn passkey create/get inside the Blink iframe.
  const sheetModal = !isBlinkDeposit && !isFlowDeposit;

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

        {mode === "withdraw" && balanceLoading ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Loading…
          </div>
        ) : mode === "withdraw" && !withdrawAddressConfigured ? (
          <div className="space-y-4 px-6 py-10 text-center text-sm text-muted-foreground">
            <p>Add a Base address before you can withdraw.</p>
            <p>USDC is sent from your wallet, yield vault, or Voi balance — in that order.</p>
            <Link
              to="/account"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-12 items-center justify-center rounded-2xl bg-foreground px-6 text-sm font-semibold text-background"
            >
              Set withdraw address
            </Link>
          </div>
        ) : mode === "withdraw" && !balanceLoading && !hasBalance ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            <p>Nothing to withdraw yet.</p>
            <p className="mt-1">Deposit USDC to your stash first.</p>
          </div>
        ) : mode === "withdraw" && !balanceLoading && hasBalance && !canWithdrawNow ? (
          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
            <p>{fmtUSD(voiBalance)} is on Voi.</p>
            <p className="mt-1">Moving Voi USDC to Base for withdrawal isn&apos;t available yet.</p>
          </div>
        ) : done ? (
          <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-positive/15 text-positive">
              <Check className="h-7 w-7" strokeWidth={2.25} />
            </div>
            <p className="font-display text-2xl">
              {mode === "deposit" ? "Deposit started." : "Withdrawal sent."}
            </p>
            <p className="text-sm text-muted-foreground">
              {mode === "deposit"
                ? "USDC may take a few minutes to arrive and start earning."
                : withdrawAddress
                  ? `USDC is on its way to ${truncateAddress(withdrawAddress)} on Base.`
                  : "USDC is on its way to your withdraw address on Base."}
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
              {mode === "withdraw" && (
                <div className="mt-3 space-y-1">
                  <div className="flex items-center justify-center gap-3">
                    <p className="text-xs text-muted-foreground">
                      {voiBalance > 0 && maxWithdraw < totalBalance
                        ? `${withdrawableLabel} withdrawable now`
                        : `Available ${availableLabel}`}
                    </p>
                    {canWithdrawNow && (
                      <button
                        type="button"
                        onClick={handleWithdrawMax}
                        className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-foreground transition-colors active:bg-secondary/70"
                      >
                        Max
                      </button>
                    )}
                  </div>
                  {breakdownParts.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      {breakdownParts.join(" · ")}
                    </p>
                  )}
                  {voiBalance > 0 && maxWithdraw < totalBalance && (
                    <p className="text-[11px] text-muted-foreground">
                      {fmtUSD(voiBalance)} on Voi included in total — Base payout coming soon.
                    </p>
                  )}
                </div>
              )}
              {mode === "withdraw" && numeric > maxWithdraw && (
                <p className="mt-2 text-xs text-destructive">Exceeds available balance.</p>
              )}
              {submitError && (
                <p className="mt-2 text-xs text-destructive">{submitError}</p>
              )}
            </div>

            <AmountKeypad value={amount} onChange={handleAmountChange} />

            {mode === "deposit" ? (
              <div className="mt-6 space-y-2">
                <p className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  From
                </p>
                <div className="overflow-hidden rounded-2xl border border-border bg-card">
                  {depositMethods.map((option, index) => {
                    if (option.id === "blink" && !blinkConfigured) return null;
                    if (option.id === "flow" && !flowConfigured) return null;

                    const Icon = option.icon;
                    const active = depositMethod === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setDepositMethod(option.id);
                          setBlinkError(null);
                          setFlowError(null);
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
            ) : mode === "deposit" && isFlowDeposit ? (
              <div className="mt-6">
                <Suspense
                  fallback={
                    <div className="flex h-14 items-center justify-center rounded-2xl bg-secondary/40">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  }
                >
                  <DynamicFlowDepositPanel
                    walletAddress={walletAddress}
                    amount={numeric}
                    onSuccess={handleFlowSuccess}
                    onErrorMessage={setFlowError}
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
