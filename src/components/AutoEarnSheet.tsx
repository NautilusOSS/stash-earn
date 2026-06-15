import { usePrivy, useUser } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useDorkFiSupplyApy } from "@/hooks/useDorkFiSupplyApy";
import { useEarnVaultApys } from "@/hooks/useEarnVaultApys";
import { useEarnVaultDetails } from "@/hooks/useEarnVaultDetails";
import { updateAutoEarnDestination } from "@/lib/api/profile.functions";
import { getAutoEarnDestination } from "@/lib/privy/profile";
import {
  AUTO_EARN_OPTIONS,
  isEarnVaultDestination,
  type AutoEarnDestination,
} from "@/lib/stash/auto-earn";

import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

export function AutoEarnSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, getAccessToken } = usePrivy();
  const { refreshUser } = useUser();
  const savedDestination = getAutoEarnDestination(user);
  const { configured: earnConfigured } = useEarnVaultDetails();
  const { apyLabels, isLoading: vaultApyLoading } = useEarnVaultApys();
  const { supplyApyLabel } = useDorkFiSupplyApy();

  const [destination, setDestination] = useState<AutoEarnDestination>(savedDestination);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDestination(getAutoEarnDestination(user));
    }
  }, [open, user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error("Please sign in again to update auto earn.");
        return;
      }

      await updateAutoEarnDestination({
        data: {
          autoEarnDestination: destination,
          accessToken,
        },
      });

      await refreshUser();
      toast.success("Auto earn updated.");
      onOpenChange(false);
    } catch {
      toast.error("Could not save auto earn setting.");
    } finally {
      setSaving(false);
    }
  };

  const highestYieldHint = () => {
    const vaultLabels = AUTO_EARN_OPTIONS.filter((option) =>
      isEarnVaultDestination(option.id),
    )
      .map((option) => {
        const apy = apyLabels[option.id];
        return apy ? `${option.label} ${apy}` : null;
      })
      .filter(Boolean);

    if (vaultLabels.length > 0 && supplyApyLabel) {
      return [...vaultLabels, `DorkFi ${supplyApyLabel}`].join(" · ");
    }
    return "Compares live APYs at deposit time";
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[2rem] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Auto earn</SheetTitle>
          <SheetDescription>
            Choose where new deposits are swept to start earning yield automatically.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {AUTO_EARN_OPTIONS.map((option) => {
            const selected = destination === option.id;
            const apyHint = isEarnVaultDestination(option.id)
              ? earnConfigured
                ? vaultApyLoading
                  ? "APY loading"
                  : apyLabels[option.id]
                    ? `${apyLabels[option.id]} APY`
                    : `${option.label} configured`
                : "Earn vault not configured"
              : option.id === "dorkfi"
                ? supplyApyLabel
                  ? `${supplyApyLabel} APY on Voi`
                  : "DorkFi APY loading"
                : highestYieldHint();

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setDestination(option.id)}
                className={`w-full rounded-2xl border px-4 py-3.5 text-left transition-colors ${
                  selected
                    ? "border-foreground bg-secondary"
                    : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium">{option.label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{apyHint}</p>
                  </div>
                  <span
                    className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${
                      selected ? "border-foreground bg-foreground" : "border-border"
                    }`}
                  >
                    {selected ? <span className="h-2 w-2 rounded-full bg-background" /> : null}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <Button
          size="lg"
          onClick={() => void handleSave()}
          disabled={saving}
          className="mt-6 h-14 w-full rounded-2xl text-base font-semibold"
        >
          {saving ? "Saving…" : "Save auto earn"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
