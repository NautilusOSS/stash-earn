import { createFileRoute } from "@tanstack/react-router";
import { usePrivy } from "@privy-io/react-auth";
import { MobileShell } from "@/components/BottomNav";
import { ProfileEditSheet } from "@/components/ProfileEditSheet";
import { UserCircle, ShieldCheck, Bell, LifeBuoy, ChevronRight, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { isDebugMode } from "@/lib/debug";
import { getPreferredName } from "@/lib/privy/profile";
import { truncateAddress } from "@/lib/privy/constants";
import {
  getLoginMethodLabel,
  getUserAvatar,
  getUserDisplayName,
  getUserEmail,
  getUserInitials,
  getUserWalletAddress,
} from "@/lib/privy/user";
import { XChainAccountSection } from "@/components/XChainAccountSection";
import { ClientOnly } from "@/components/ClientOnly";
import { X402DebugSection } from "@/components/X402DebugSection";
import { VoiUsdcOptInDebugSection } from "@/components/VoiUsdcOptInDebugSection";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — Cash Stash" },
      {
        name: "description",
        content: "Manage your profile, security, and notifications.",
      },
      { property: "og:title", content: "Account — Cash Stash" },
      {
        property: "og:description",
        content: "Manage your profile, security, and notifications.",
      },
    ],
  }),
  component: AccountPage,
  errorComponent: AccountError,
});

function AccountError({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  return (
    <MobileShell>
      <div className="px-4 py-12 text-center">
        <p className="font-medium text-foreground">Account failed to load</p>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
      </div>
    </MobileShell>
  );
}

function AccountPage() {
  const { user, logout } = usePrivy();
  const [profileOpen, setProfileOpen] = useState(false);

  const displayName = getUserDisplayName(user);
  const preferredName = getPreferredName(user);
  const avatar = getUserAvatar(user);
  const email = getUserEmail(user);
  const initials = getUserInitials(user);
  const loginMethod = getLoginMethodLabel(user);
  const walletAddress = getUserWalletAddress(user);
  const debug = isDebugMode();

  const settingsItems: Array<{
    icon: typeof UserCircle;
    label: string;
    sub: string;
    onClick?: () => void;
  }> = [
    {
      icon: UserCircle,
      label: "Profile",
      sub: preferredName ? `${preferredName} · name & avatar` : "Set your preferred name",
      onClick: () => setProfileOpen(true),
    },
    { icon: ShieldCheck, label: "Security", sub: `${loginMethod} · Face ID on device` },
    { icon: Bell, label: "Notifications", sub: "Daily earnings, transfers" },
    { icon: LifeBuoy, label: "Support", sub: "Help center, contact us" },
  ];

  return (
    <MobileShell>
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Account</p>
        <h1 className="font-display mt-1 text-4xl">You</h1>
      </header>

      <section className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-foreground text-lg font-semibold text-background">
          {avatar ?? initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">{displayName}</p>
          <p className="truncate text-sm text-muted-foreground">{email ?? loginMethod}</p>
        </div>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="text-sm font-medium text-foreground underline underline-offset-2"
        >
          Edit
        </button>
      </section>

      <section className="mt-6">
        <h2 className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Settings</h2>
        <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
          {settingsItems.map(({ icon: Icon, label, sub, onClick }) => (
            <button
              key={label}
              type="button"
              onClick={onClick}
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

      <XChainAccountSection evmAddress={walletAddress} />

      {debug ? (
        <section className="mt-6">
          <h2 className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">Debug</h2>
          <div className="mt-2 divide-y divide-border rounded-2xl border border-dashed border-border bg-card">
            <DebugField label="Privy ID" value={user?.id} />
            <DebugField
              label="Wallet"
              value={walletAddress}
              display={walletAddress ? truncateAddress(walletAddress) : undefined}
            />
            <ClientOnly>
              <VoiUsdcOptInDebugSection walletAddress={walletAddress} />
              <X402DebugSection walletAddress={walletAddress} />
            </ClientOnly>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={logout}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 text-sm font-medium text-muted-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Cash Stash · Simple savings with automatic yield
      </p>

      <ProfileEditSheet open={profileOpen} onOpenChange={setProfileOpen} />
    </MobileShell>
  );
}

function DebugField({
  label,
  value,
  display,
}: {
  label: string;
  value: string | undefined;
  display?: string;
}) {
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      className="flex w-full flex-col gap-1 px-4 py-3.5 text-left disabled:opacity-50"
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="break-all font-mono text-[13px]">{display ?? value ?? "—"}</p>
    </button>
  );
}
