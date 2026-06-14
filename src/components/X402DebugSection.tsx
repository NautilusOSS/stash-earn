import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useEarnPosition } from "@/hooks/useEarnPosition";
import { useWalletUsdcBalance } from "@/hooks/useWalletUsdcBalance";
import { useX402FacilitatorStatus } from "@/hooks/useX402FacilitatorStatus";
import { useX402SmokeTest } from "@/hooks/useX402SmokeTest";
import { parseX402DollarAmount } from "@/lib/x402/client";
import { truncateAddress } from "@/lib/privy/constants";
import { fmtUSD } from "@/lib/stash";

type X402DebugSectionProps = {
  walletAddress: string | undefined;
};

/**
 * Debug-only x402 smoke test on Base mainnet USDC.
 * Browser signs the payment authorization; server verifies and settles.
 */
export function X402DebugSection({ walletAddress }: X402DebugSectionProps) {
  const { runSmokeTest, isRunning, result, error, amount } = useX402SmokeTest(walletAddress);
  const { baseBalance, isLoading: walletLoading } = useWalletUsdcBalance(walletAddress);
  const { assetsInVault, isLoading: positionLoading } = useEarnPosition(walletAddress);
  const {
    isConfigured: facilitatorConfigured,
    facilitatorAddress,
    ethBalance,
    hasGas,
    chainId,
    payerUsdcBalance,
    serverUsdcReady,
    requiredUsdc,
    rpcHost,
    rpcError,
    payerWalletKind,
    payerEip3009Compatible,
    isLoading: facilitatorLoading,
    isFetching: facilitatorFetching,
    error: facilitatorError,
    refetch: refetchFacilitator,
  } = useX402FacilitatorStatus(walletAddress);

  const requiredAmount = parseX402DollarAmount(amount);
  const preflightLoading = walletLoading || positionLoading || facilitatorLoading;
  const clientWalletReady = baseBalance >= requiredAmount;
  const serverWalletReady = serverUsdcReady === true;
  const diagnosticsUnavailable = !facilitatorLoading && !facilitatorConfigured && !facilitatorError;
  const clientServerMismatch =
    serverUsdcReady === false &&
    clientWalletReady &&
    Math.abs(payerUsdcBalance - baseBalance) > 0.000_001;
  const fundsInVaultOnly = !clientWalletReady && assetsInVault >= requiredAmount;
  const canRun =
    Boolean(walletAddress) &&
    clientWalletReady &&
    serverWalletReady &&
    hasGas &&
    facilitatorConfigured &&
    payerEip3009Compatible &&
    !rpcError &&
    !isRunning;

  return (
    <div className="px-4 py-3.5">
      <p className="text-xs text-muted-foreground">x402 Base payment</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Pays {amount} USDC via x402 to unlock <code className="text-foreground">/api/x402/protected</code>.
        Uses Base USDC in your embedded wallet only — not the Earn vault.
      </p>

      <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Facilitator (EVM_PRIVATE_KEY)</p>
          <button
            type="button"
            onClick={() => void refetchFacilitator()}
            disabled={facilitatorLoading || facilitatorFetching}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-foreground disabled:opacity-50"
            aria-label="Refresh facilitator status"
          >
            {facilitatorFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
        <PreflightRow
          label="Relayer address"
          value={
            facilitatorLoading
              ? "…"
              : facilitatorConfigured && facilitatorAddress
                ? truncateAddress(facilitatorAddress)
                : "Not configured"
          }
          copyValue={facilitatorAddress}
          detail={facilitatorConfigured && chainId ? `Chain ${chainId}` : undefined}
        />
        <PreflightRow
          label="Relayer ETH"
          value={facilitatorLoading ? "…" : facilitatorConfigured ? `${ethBalance.toFixed(6)} ETH` : "—"}
          detail="Pays Base gas to settle USDC"
          ok={facilitatorConfigured ? hasGas : undefined}
        />
        {!facilitatorLoading && facilitatorConfigured && !hasGas ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Facilitator is low on ETH. Fund the relayer on Base for settlement.
          </p>
        ) : null}
        {facilitatorError ? (
          <p className="text-xs text-destructive">{facilitatorError}</p>
        ) : null}
      </div>

      <div className="mt-3 space-y-2 rounded-xl border border-border bg-secondary/30 px-3 py-2.5">
        <p className="text-xs text-muted-foreground">Preflight</p>
        <PreflightRow
          label="Wallet USDC (browser RPC)"
          value={preflightLoading ? "…" : fmtUSD(baseBalance)}
          detail={`Need ${amount} in wallet`}
          ok={clientWalletReady}
        />
        <PreflightRow
          label="Wallet USDC (server RPC)"
          value={
            preflightLoading
              ? "…"
              : rpcError
                ? "RPC error"
                : fmtUSD(payerUsdcBalance)
          }
          detail={
            rpcHost ? `EVM_RPC_URL · ${rpcHost} · need ${requiredUsdc}` : `Need ${requiredUsdc}`
          }
          ok={serverUsdcReady ?? undefined}
        />
        <PreflightRow
          label="Payer wallet type"
          value={
            preflightLoading
              ? "…"
              : payerWalletKind === "eoa"
                ? "EOA"
                : payerWalletKind === "eip7702"
                  ? "EIP-7702 (Kernel)"
                  : "Contract"
          }
          detail={
            payerWalletKind === "eip7702"
              ? "Kernel ERC-1271 signing enabled"
              : payerEip3009Compatible
                ? "Compatible with USDC EIP-3009"
                : "USDC EIP-3009 needs EOA or Kernel 7702"
          }
          ok={payerEip3009Compatible}
        />
        <PreflightRow
          label="Earn vault USDC"
          value={preflightLoading ? "…" : fmtUSD(assetsInVault)}
          detail="Not spendable via x402"
        />
        {!preflightLoading && diagnosticsUnavailable ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Server x402 diagnostics unavailable. Check EVM_PRIVATE_KEY, EVM_RPC_URL, and
            EVM_RECEIVER_ADDRESS in the server env.
          </p>
        ) : null}
        {rpcError ? (
          <p className="text-xs text-destructive">Server RPC error: {rpcError}</p>
        ) : null}
        {!preflightLoading && clientServerMismatch ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Browser and server disagree on wallet USDC. x402 verify uses EVM_RPC_URL — fix or
            replace the server RPC.
          </p>
        ) : null}
        {!preflightLoading && payerWalletKind === "eip7702" ? (
          <p className="text-xs text-muted-foreground">
            EIP-7702 Kernel wallet detected. x402 signs USDC authorizations via Kernel wrapper +
            ERC-1271 bytes.
          </p>
        ) : null}
        {!preflightLoading && payerWalletKind === "contract" ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Payer address has non-7702 contract bytecode. USDC EIP-3009 requires an EOA or EIP-7702
            Kernel wallet.
          </p>
        ) : null}
        {!preflightLoading && fundsInVaultOnly ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            USDC is in the Earn vault. Withdraw {amount} or more to your wallet before testing.
          </p>
        ) : null}
        {!preflightLoading && clientWalletReady && serverWalletReady && hasGas ? (
          <p className="text-xs text-positive">Client, server, and relayer preflight look OK.</p>
        ) : null}
        {!preflightLoading && clientWalletReady && serverWalletReady && !hasGas ? (
          <p className="text-xs text-amber-600 dark:text-amber-500">
            Wallet USDC looks fine, but the relayer needs Base ETH.
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={runSmokeTest}
        disabled={!canRun}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-secondary py-3 text-sm font-medium disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Paying & verifying…
          </>
        ) : (
          `Smoke test · ${amount} USDC`
        )}
      </button>

      {!preflightLoading && !clientWalletReady && walletAddress ? (
        <p className="mt-2 flex items-start gap-1.5 text-sm text-amber-600 dark:text-amber-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Fund or withdraw at least {amount} Base USDC to your embedded wallet.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-positive/10 px-3 py-2 text-sm text-positive">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Payment succeeded</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{result.message}</p>
            {result.voiUsdc?.txId ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Voi USDC sent · tx {result.voiUsdc.txId.slice(0, 10)}…
              </p>
            ) : null}
            {result.voiUsdc?.skipped || result.voiUsdc?.error ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Voi USDC: {result.voiUsdc.skipped ?? result.voiUsdc.error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PreflightRow({
  label,
  value,
  detail,
  ok,
  copyValue,
}: {
  label: string;
  value: string;
  detail?: string;
  ok?: boolean;
  copyValue?: string;
}) {
  const copy = async () => {
    if (!copyValue) return;
    try {
      await navigator.clipboard.writeText(copyValue);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {detail ? <p className="text-[11px] text-muted-foreground">{detail}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <p
          className={
            ok === true
              ? "text-sm font-medium tabular-nums text-positive"
              : "text-sm font-medium tabular-nums"
          }
        >
          {value}
        </p>
        {copyValue ? (
          <button
            type="button"
            onClick={() => void copy()}
            className="grid h-7 w-7 place-items-center rounded-lg border border-border bg-card"
            aria-label={`Copy ${label}`}
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
