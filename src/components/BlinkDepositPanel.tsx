import { BlinkDepositButton } from "@swype-org/deposit/react";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { BlinkOverlayUnlock } from "@/components/blink/BlinkOverlayUnlock";
import { Button } from "@/components/ui/button";
import { useBlinkConfigured } from "@/hooks/useBlinkConfigured";
import { useBlinkStashDeposit } from "@/hooks/useBlinkStashDeposit";
import { getBlinkChainConfig, getBlinkEnvironmentClient } from "@/lib/blink/config";
import { fetchWalletEthBalance } from "@/lib/privy/ethBalance";
import { validateEvmAddress } from "@/lib/xchain/validate";

type BlinkDepositPanelProps = {
  walletAddress: string | undefined;
  amount: number;
  onSuccess: () => void;
  onErrorMessage?: (message: string | null) => void;
};

const LOW_ETH_THRESHOLD = 0.0005;

function BlinkDepositPanelReady({
  walletAddress,
  amount,
  onSuccess,
  onErrorMessage,
}: BlinkDepositPanelProps) {
  const { environment } = useBlinkConfigured();
  const chain = getBlinkChainConfig(environment);
  const clientEnv = getBlinkEnvironmentClient();
  const [stashEthLow, setStashEthLow] = useState(false);

  const {
    depositReady,
    depositWithBlink,
    cancelBlink,
    loading,
    status,
    displayMessage,
  } = useBlinkStashDeposit(walletAddress);

  const hasWallet = Boolean(walletAddress);
  const hasAmount = amount > 0;
  const canSubmit = depositReady && hasWallet && hasAmount && !loading;

  useEffect(() => {
    onErrorMessage?.(displayMessage);
  }, [displayMessage, onErrorMessage]);

  useEffect(() => {
    if (!walletAddress) {
      setStashEthLow(false);
      return;
    }

    const validation = validateEvmAddress(walletAddress);
    if (!validation.valid) return;

    void fetchWalletEthBalance(validation.normalized).then((eth) => {
      setStashEthLow(eth < LOW_ETH_THRESHOLD);
    });
  }, [walletAddress]);

  const handleSubmit = () => {
    if (!hasAmount) {
      toast.error("Enter an amount above $0.");
      return;
    }
    if (!hasWallet) {
      toast.error("Wallet is still loading. Try again in a moment.");
      return;
    }
    if (!depositReady) {
      toast.error("Blink is still starting. Try again in a moment.");
      return;
    }
    if (loading) return;

    void depositWithBlink(amount).then((result) => {
      if (!result.ok) {
        onErrorMessage?.(result.error);
        toast.error(result.error);
        return;
      }
      onSuccess();
    });
  };

  let hint: string | null = null;
  if (!hasAmount) hint = "Enter an amount above $0 to deposit with Blink.";
  else if (!hasWallet) hint = "Waiting for your wallet…";
  else if (!depositReady) hint = "Starting Blink…";
  else if (status === "signer-loading") hint = "Preparing Blink…";
  else if (status === "iframe-active")
    hint =
      "Approve in Blink, then check the wallet you connected: it needs ETH on Base for gas (not just USDC). If using MetaMask or Coinbase extension, open the extension — the approval popup may be hidden behind Blink.";

  return (
    <div className="space-y-2">
      {loading && <BlinkOverlayUnlock />}
      {environment === "sandbox" && (
        <p className="text-center text-xs text-muted-foreground">
          Sandbox Blink settles on {chain.label} (chain {chain.chainId}). Your Privy wallet stays on
          Base mainnet for earn — use a testnet wallet in Blink (MetaMask on Base Sepolia with
          faucet USDC) or switch to production Blink for real deposits.
        </p>
      )}
      {clientEnv !== environment && (
        <p className="text-center text-xs text-destructive">
          Blink env mismatch (client={clientEnv}, server={environment}). Restart dev server after
          changing .env.
        </p>
      )}
      {stashEthLow && !loading && (
        <p className="text-center text-xs text-amber-700 dark:text-amber-500">
          Your Cash Stash wallet has little or no ETH on Base. After USDC arrives, add ~$1 of ETH
          (Debit card or crypto account) so auto-earn can run.
        </p>
      )}
      {!loading && (
        <p className="text-center text-xs text-muted-foreground">
          In Blink, fund from <strong className="font-medium text-foreground">MetaMask</strong> (or
          Coinbase Wallet extension) on Base — not &quot;Base Account&quot;. Connect the wallet inside
          Blink first (you should see your address). Needs USDC + a little ETH for gas on Base.
        </p>
      )}
      {loading && status === "iframe-active" && (
        <p className="text-center text-xs text-amber-800 dark:text-amber-400">
          If stuck on Processing: open your MetaMask extension and approve the transaction. Do not
          use Base Account in Blink — its Privy iframe often fails inside Blink (&quot;Exceeded max
          attempts&quot;). Link MetaMask in Blink settings if needed.
        </p>
      )}
      {hint && <p className="text-center text-xs text-muted-foreground">{hint}</p>}
      <BlinkDepositButton onClick={handleSubmit} disabled={!canSubmit} loading={loading} />
      {loading && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-full text-muted-foreground"
          onClick={() => {
            cancelBlink();
            toast.message("Blink closed", {
              description: "If a wallet approval is still pending, check your extension or wallet app.",
            });
          }}
        >
          Cancel Blink
        </Button>
      )}
    </div>
  );
}

export function BlinkDepositPanel(props: BlinkDepositPanelProps) {
  const { configured, isLoading } = useBlinkConfigured();

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
        Blink deposits are not configured on this server.
      </p>
    );
  }

  return <BlinkDepositPanelReady {...props} />;
}
