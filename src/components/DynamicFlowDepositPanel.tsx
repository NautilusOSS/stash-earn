import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDynamicConfigured } from "@/hooks/useDynamicConfigured";
import { useDynamicFlowDeposit } from "@/hooks/useDynamicFlowDeposit";
import { DYNAMIC_EVM_CHAINS, getTokensForChain } from "@/lib/dynamic/chains";
import { truncateAddress } from "@/lib/privy/constants";

type DynamicFlowDepositPanelProps = {
  walletAddress: string | undefined;
  amount: number;
  onSuccess: () => void;
  onErrorMessage?: (message: string | null) => void;
  onStartedChange?: (started: boolean) => void;
};

function DynamicFlowDepositPanelReady({
  walletAddress,
  amount,
  onSuccess,
  onErrorMessage,
  onStartedChange,
}: DynamicFlowDepositPanelProps) {
  const {
    step,
    error,
    sourceAddress,
    sourceChain,
    selectedToken,
    quote,
    isBusy,
    startDeposit,
    connectSourceWallet,
    selectSourceChain,
    requestQuote,
    confirmAndSign,
    cancelFlow,
    reset,
  } = useDynamicFlowDeposit(walletAddress);

  const [started, setStarted] = useState(false);

  useEffect(() => {
    onErrorMessage?.(error);
  }, [error, onErrorMessage]);

  useEffect(() => {
    setStarted(false);
    reset();
  }, [amount, reset]);

  useEffect(() => {
    onStartedChange?.(started);
  }, [started, onStartedChange]);

  const hasAmount = amount > 0;
  const hasWallet = Boolean(walletAddress);
  const tokens = sourceChain ? getTokensForChain(sourceChain.chainId) : [];

  const handleBegin = async () => {
    if (!hasAmount) {
      toast.error("Enter an amount above $0.");
      return;
    }
    if (!hasWallet) {
      toast.error("Wallet is still loading. Try again in a moment.");
      return;
    }

    const ok = await startDeposit(amount);
    if (ok) setStarted(true);
  };

  const handleConnect = async () => {
    const ok = await connectSourceWallet();
    if (!ok) return;
    toast.message("Wallet connected", {
      description: "Pick the network and token you want to send from.",
    });
  };

  const handleConfirm = async () => {
    const ok = await confirmAndSign();
    if (!ok) return;
    onSuccess();
  };

  if (!started) {
    return (
      <div className="space-y-2">
        <p className="text-center text-xs text-muted-foreground">
          Pay from MetaMask, Coinbase Wallet, or another browser wallet. We convert your token to
          USDC on Base and move it into your stash.
        </p>
        <Button
          type="button"
          size="lg"
          disabled={!hasAmount || !hasWallet || isBusy}
          onClick={() => void handleBegin()}
          className="h-14 w-full rounded-2xl text-base font-semibold"
        >
          {isBusy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Starting…
            </span>
          ) : (
            `Deposit ${hasAmount ? `$${amount.toFixed(2)}` : ""}`.trim()
          )}
        </Button>
      </div>
    );
  }

  if (step === "wallet") {
    return (
      <div className="space-y-3">
        <p className="text-center text-xs text-muted-foreground">
          Connect the wallet that holds the token you want to send. This is separate from your Cash
          Stash wallet — USDC will land in your stash wallet after conversion.
        </p>
        <Button
          type="button"
          size="lg"
          onClick={() => void handleConnect()}
          className="h-14 w-full rounded-2xl text-base font-semibold"
        >
          Connect wallet
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => void cancelFlow()}
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (step === "token" || step === "quoting") {
    return (
      <div className="space-y-3">
        {sourceAddress && (
          <p className="text-center text-xs text-muted-foreground">
            From {truncateAddress(sourceAddress)}
          </p>
        )}

        <div className="space-y-2">
          <p className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Network</p>
          <div className="flex flex-wrap gap-2">
            {DYNAMIC_EVM_CHAINS.map((chain) => {
              const active = sourceChain?.chainId === chain.chainId;
              return (
                <button
                  key={chain.chainId}
                  type="button"
                  onClick={() => selectSourceChain(chain)}
                  className={
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
                    (active
                      ? "bg-foreground text-background"
                      : "bg-secondary text-foreground active:bg-secondary/70")
                  }
                >
                  {chain.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {sourceChain && (
          <div className="space-y-2">
            <p className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Token</p>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              {tokens.map((token, index) => (
                <button
                  key={token.address}
                  type="button"
                  disabled={step === "quoting"}
                  onClick={() => void requestQuote(token)}
                  className={
                    "flex w-full items-center justify-between px-4 py-3 text-left text-sm transition-colors " +
                    (index > 0 ? "border-t border-border " : "") +
                    (selectedToken?.address === token.address
                      ? "bg-secondary/60"
                      : "bg-transparent")
                  }
                >
                  <span className="font-medium">{token.symbol}</span>
                  {step === "quoting" && selectedToken?.address === token.address ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => void cancelFlow()}
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (step === "review" || step === "signing") {
    return (
      <div className="space-y-3">
        {quote && (
          <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">You send</span>
              <span className="font-medium tabular-nums">
                {quote.fromAmount} {selectedToken?.symbol}
              </span>
            </div>
            <div className="mt-2 flex justify-between">
              <span className="text-muted-foreground">You receive</span>
              <span className="font-medium tabular-nums">${quote.toAmount} USDC</span>
            </div>
            {quote.fees?.totalFeeUsd && (
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Fees</span>
                <span className="tabular-nums">${quote.fees.totalFeeUsd}</span>
              </div>
            )}
            {quote.estimatedTimeSec != null && (
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Est. time</span>
                <span>~{Math.ceil(quote.estimatedTimeSec / 60)} min</span>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground">
          Quote expires in about 60 seconds. Approve in your wallet when prompted — ERC-20 deposits
          may need a token approval first.
        </p>

        <Button
          type="button"
          size="lg"
          disabled={step === "signing"}
          onClick={() => void handleConfirm()}
          className="h-14 w-full rounded-2xl text-base font-semibold"
        >
          {step === "signing" ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Confirm in wallet…
            </span>
          ) : (
            "Confirm deposit"
          )}
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full"
          disabled={step === "signing"}
          onClick={() => void cancelFlow()}
        >
          Cancel
        </Button>
      </div>
    );
  }

  if (step === "settling") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm font-medium">Converting to USDC…</p>
        <p className="text-xs text-muted-foreground">
          Cross-chain deposits can take a few minutes. Keep this sheet open or check your balance
          shortly.
        </p>
      </div>
    );
  }

  return null;
}

export function DynamicFlowDepositPanel(props: DynamicFlowDepositPanelProps) {
  const { configured, isLoading } = useDynamicConfigured();

  if (isLoading) {
    return (
      <div className="flex h-14 items-center justify-center rounded-2xl bg-secondary/40">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!configured) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Any-crypto deposits are not configured on this server.
      </p>
    );
  }

  return <DynamicFlowDepositPanelReady {...props} />;
}
