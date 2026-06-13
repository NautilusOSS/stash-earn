import { createFileRoute } from "@tanstack/react-router";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { MobileShell } from "@/components/BottomNav";
import {
  Wallet,
  ShieldCheck,
  Bell,
  LifeBuoy,
  ChevronRight,
  LogOut,
  Copy,
  Check,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { truncateAddress } from "@/lib/privy/constants";
import {
  getLoginMethodLabel,
  getUserDisplayName,
  getUserEmail,
  getUserInitials,
} from "@/lib/privy/user";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — Cash Stash" },
      {
        name: "description",
        content: "Manage your profile, wallet, security, and notifications.",
      },
      { property: "og:title", content: "Account — Cash Stash" },
      {
        property: "og:description",
        content: "Manage your profile, wallet, security, and notifications.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { user, logout } = usePrivy();
  const { wallets } = useWallets();
  const [copied, setCopied] = useState(false);

  const displayName = getUserDisplayName(user);
  const email = getUserEmail(user);
  const initials = getUserInitials(user);
  const loginMethod = getLoginMethodLabel(user);

  const embeddedWallet = wallets.find((w) => w.walletClientType === "privy");
  const walletAddress = embeddedWallet?.address;

  const copyAddress = async () => {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    toast.success("Wallet address copied.");
    setTimeout(() => setCopied(false), 2000);
  };

  const settingsItems = [
    { icon: ShieldCheck, label: "Security", sub: `${loginMethod} · Face ID on device` },
    { icon: Bell, label: "Notifications", sub: "Daily earnings, transfers" },
    { icon: LifeBuoy, label: "Support", sub: "Help center, contact us" },
  ] as const;

  return (
    <MobileShell>
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Account</p>
        <h1 className="font-display mt-1 text-4xl">You</h1>
      </header>

      <section className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-foreground text-lg font-semibold text-background">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{displayName}</p>
          <p className="truncate text-sm text-muted-foreground">{email ?? loginMethod}</p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Wallet</h2>
        <div className="mt-2 rounded-2xl border border-border bg-card">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
              <Wallet className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium">Stash wallet</p>
              <p className="truncate font-mono text-xs text-muted-foreground">
                {walletAddress ? truncateAddress(walletAddress) : "Creating wallet…"}
              </p>
            </div>
            {walletAddress && (
              <button
                type="button"
                onClick={copyAddress}
                className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground"
                aria-label="Copy wallet address"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-positive" strokeWidth={2} />
                ) : (
                  <Copy className="h-4 w-4" strokeWidth={1.75} />
                )}
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 px-1 text-[11px] text-muted-foreground">
          Your embedded wallet on Base holds USDC and earns yield via Privy Earn vaults.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Settings</h2>
        <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
          {settingsItems.map(({ icon: Icon, label, sub }) => (
            <button
              key={label}
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className="grid h-9 w-9 place-items-center rounded-full bg-secondary">
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{label}</p>
                <p className="truncate text-xs text-muted-foreground">{sub}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>

      <button
        type="button"
        onClick={logout}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 text-sm font-medium text-muted-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Cash Stash · Yield via Privy Earn on Base
      </p>
    </MobileShell>
  );
}
