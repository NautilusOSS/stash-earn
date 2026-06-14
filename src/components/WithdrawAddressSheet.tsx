import { usePrivy, useUser } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { updateWithdrawAddress } from "@/lib/api/profile.functions";
import { truncateAddress } from "@/lib/privy/constants";
import { getWithdrawAddress } from "@/lib/privy/profile";
import { validateEvmAddress } from "@/lib/xchain/validate";

import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

export function WithdrawAddressSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, getAccessToken } = usePrivy();
  const { refreshUser } = useUser();
  const savedAddress = getWithdrawAddress(user);

  const [address, setAddress] = useState(savedAddress ?? "");
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAddress(getWithdrawAddress(user) ?? "");
      setFieldError(null);
    }
  }, [open, user]);

  const trimmed = address.trim();
  const validation = trimmed ? validateEvmAddress(trimmed) : null;
  const canSave = !!validation?.valid && !saving;

  const handleSave = async () => {
    if (!validation?.valid) {
      setFieldError(validation?.error ?? "Enter a valid Base address.");
      return;
    }

    setSaving(true);
    setFieldError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error("Please sign in again to save your withdraw address.");
        return;
      }

      await updateWithdrawAddress({
        data: {
          withdrawAddress: validation.normalized,
          accessToken,
        },
      });

      await refreshUser();
      toast.success("Withdraw address saved.");
      onOpenChange(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save your withdraw address.";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-[2rem] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl">Withdraw address</SheetTitle>
          <SheetDescription>
            USDC from your stash is sent to this Base address after leaving the yield vault.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="withdraw-address">Base address</Label>
            <Input
              id="withdraw-address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setFieldError(null);
              }}
              placeholder="0x…"
              className="h-12 rounded-xl font-mono text-sm"
              autoComplete="off"
              spellCheck={false}
            />
            {savedAddress ? (
              <p className="text-xs text-muted-foreground">
                Current: {truncateAddress(savedAddress)}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Required before you can withdraw. Use a wallet you control on Base mainnet.
              </p>
            )}
            {fieldError ? <p className="text-xs text-destructive">{fieldError}</p> : null}
          </div>

          <Button
            size="lg"
            onClick={handleSave}
            disabled={!canSave}
            className="h-14 w-full rounded-2xl text-base font-semibold"
          >
            {saving ? "Saving…" : savedAddress ? "Update address" : "Save address"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
