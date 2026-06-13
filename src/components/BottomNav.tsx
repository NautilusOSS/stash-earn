import { Link } from "@tanstack/react-router";
import { Home, Receipt, User } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/activity", label: "Activity", icon: Receipt },
  { to: "/account", label: "Account", icon: User },
] as const;

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md items-stretch justify-around px-2 py-2">
        {tabs.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              activeOptions={{ exact: true }}
              className="group flex flex-col items-center gap-1 rounded-2xl px-3 py-2 text-muted-foreground transition-colors data-[status=active]:text-foreground"
            >
              <Icon className="h-5 w-5 transition-transform group-data-[status=active]:scale-110" strokeWidth={1.75} />
              <span className="text-[11px] font-medium tracking-wide">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MobileShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background pb-28">
      <div className="mx-auto max-w-md px-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {children}
      </div>
      <BottomNav />
      <Toaster position="top-center" />
    </div>
  );
}