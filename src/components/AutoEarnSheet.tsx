import { usePrivy, useUser } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { EarnDestinationPicker } from "@/components/EarnDestinationPicker";
import { updateAutoEarnDestination } from "@/lib/api/profile.functions";
import { getAutoEarnDestination } from "@/lib/privy/profile";
import { type AutoEarnDestination } from "@/lib/stash/auto-earn";

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

        <div className="mt-6">
          <EarnDestinationPicker
            destination={destination}
            onDestinationChange={setDestination}
          />
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
