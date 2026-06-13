import { CheckCircle2, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useXChainAddress } from "@/hooks/useXChainAddress";
import { useXChainSelfPayment } from "@/hooks/useXChainSelfPayment";
import { truncateAddress } from "@/lib/privy/constants";
import { VOI_BLOCK_EXPLORER_TX } from "@/lib/voi/constants";

type XChainAccountSectionProps = {
  evmAddress: string | undefined;
};

export function XChainAccountSection({ evmAddress }: XChainAccountSectionProps) {
  const {
    voiAddress,
    voiExecutionAddress,
    isLoading,
    error: addressError,
  } = useXChainAddress(evmAddress);

  const {
    sendZeroVoiSelfPayment,
    isPreparing,
    isSigning,
    isSubmitting,
    submitResult,
    error: selfPaymentError,
  } = useXChainSelfPayment(evmAddress);

  const isBusy = isPreparing || isSigning || isSubmitting;
  const executionDiffers =
    voiAddress != null && voiExecutionAddress != null && voiAddress !== voiExecutionAddress;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  if (!evmAddress) {
    return (
      <section className="mt-6">
        <h2 className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
          Voi xChain
        </h2>
        <p className="mt-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm text-muted-foreground">
          Connect an EVM wallet to derive your Voi xChain address.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <h2 className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Voi xChain</h2>

      <div className="mt-2 space-y-3 rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Your Voi account is derived from your EVM wallet — no Algorand seed phrase needed. Voi
          mainnet runs AVM v10 today, so you have two linked addresses until v11 execution is
          enabled.
        </p>

        <AddressRow
          label="EVM wallet"
          value={evmAddress}
          display={truncateAddress(evmAddress)}
          onCopy={() => copy("EVM address", evmAddress)}
        />

        {isLoading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Deriving xChain addresses…
          </div>
        ) : addressError ? (
          <p className="text-sm text-destructive">{addressError}</p>
        ) : (
          <>
            <AddressRow
              label="Canonical xChain address (AVM v11)"
              value={voiAddress}
              display={voiAddress ? truncateAddress(voiAddress) : undefined}
              onCopy={() => voiAddress && copy("Canonical address", voiAddress)}
              hint="Matches AlgoVoi and the broader xChain ecosystem"
            />

            {executionDiffers ? (
              <AddressRow
                label="Execution address (AVM v10)"
                value={voiExecutionAddress}
                display={voiExecutionAddress ? truncateAddress(voiExecutionAddress) : undefined}
                onCopy={() => voiExecutionAddress && copy("Execution address", voiExecutionAddress)}
                hint="Fund this for self-payment and on-chain transactions on Voi today"
                highlight
              />
            ) : null}
          </>
        )}

        <button
          type="button"
          disabled={isBusy || isLoading || !!addressError || !voiExecutionAddress}
          onClick={() => void sendZeroVoiSelfPayment()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {isPreparing ? "Preparing…" : isSigning ? "Sign in wallet…" : "Submitting…"}
            </>
          ) : (
            "Sign & submit 0 VOI self-payment"
          )}
        </button>

        {selfPaymentError ? <p className="text-sm text-destructive">{selfPaymentError}</p> : null}

        {submitResult ? (
          <div className="rounded-xl border border-positive/30 bg-positive/5 p-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-positive" strokeWidth={1.75} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-positive">Self-payment confirmed</p>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  {submitResult.txId}
                </p>
                <p className="text-xs text-muted-foreground">
                  Round {submitResult.confirmedRound} · sender{" "}
                  {truncateAddress(submitResult.voiExecutionAddress)}
                </p>
                <a
                  href={`${VOI_BLOCK_EXPLORER_TX}/${submitResult.txId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2"
                >
                  View on block.voi.network
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AddressRow({
  label,
  value,
  display,
  onCopy,
  hint,
  highlight,
}: {
  label: string;
  value: string | undefined;
  display?: string;
  onCopy: () => void;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-xl border border-primary/20 bg-primary/5 p-3"
          : "rounded-xl border border-border bg-secondary/30 p-3"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 break-all font-mono text-[13px]">{display ?? value ?? "—"}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <button
          type="button"
          disabled={!value}
          onClick={onCopy}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-card disabled:opacity-50"
          aria-label={`Copy ${label}`}
        >
          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
