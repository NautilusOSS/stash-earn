import { createFileRoute } from "@tanstack/react-router";
import { MobileShell } from "@/components/BottomNav";
import {
  Building2,
  ShieldCheck,
  Bell,
  LifeBuoy,
  ChevronRight,
  LogOut,
} from "lucide-react";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "Account — Cash Stash" },
      { name: "description", content: "Manage your profile, linked accounts, security, and notifications." },
      { property: "og:title", content: "Account — Cash Stash" },
      { property: "og:description", content: "Manage your profile, linked accounts, security, and notifications." },
    ],
  }),
  component: AccountPage,
});

const sections: { title: string; items: { icon: any; label: string; sub: string }[] }[] = [
  {
    title: "Money",
    items: [
      { icon: Building2, label: "Linked bank accounts", sub: "Chase ••4421" },
    ],
  },
  {
    title: "Settings",
    items: [
      { icon: ShieldCheck, label: "Security", sub: "Face ID, passcode, devices" },
      { icon: Bell, label: "Notifications", sub: "Daily earnings, transfers" },
      { icon: LifeBuoy, label: "Support", sub: "Help center, contact us" },
    ],
  },
];

function AccountPage() {
  return (
    <MobileShell>
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Account</p>
        <h1 className="font-display mt-1 text-4xl">You</h1>
      </header>

      <section className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-foreground text-lg font-semibold text-background">
          A
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold">Alex Morgan</p>
          <p className="truncate text-sm text-muted-foreground">alex@stash.app</p>
        </div>
        <button className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium">
          Edit
        </button>
      </section>

      {sections.map((s) => (
        <section key={s.title} className="mt-6">
          <h2 className="px-1 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {s.title}
          </h2>
          <div className="mt-2 divide-y divide-border rounded-2xl border border-border bg-card">
            {s.items.map(({ icon: Icon, label, sub }) => (
              <button
                key={label}
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
      ))}

      <button className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card py-4 text-sm font-medium text-muted-foreground">
        <LogOut className="h-4 w-4" />
        Sign out
      </button>

      <p className="mt-6 text-center text-[11px] text-muted-foreground">
        Cash Stash · A simple place to keep cash.
      </p>
    </MobileShell>
  );
}