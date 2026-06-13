import { usePrivy, useUser } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { updateProfile } from "@/lib/api/profile.functions";
import {
  getPreferredName,
  getUserProfile,
  PROFILE_NAME_EXAMPLES,
  PROFILE_NAME_MAX_LENGTH,
} from "@/lib/privy/profile";

import { AvatarPicker } from "./AvatarPicker";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet";

export function ProfileEditSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user, getAccessToken } = usePrivy();
  const { refreshUser } = useUser();
  const profile = getUserProfile(user);

  const [preferredName, setPreferredName] = useState(profile.preferredName ?? "");
  const [avatar, setAvatar] = useState(profile.avatar);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setPreferredName(getPreferredName(user) ?? "");
      setAvatar(getUserProfile(user).avatar);
    }
  }, [open, user]);

  const trimmedName = preferredName.trim();
  const canSave =
    trimmedName.length > 0 && trimmedName.length <= PROFILE_NAME_MAX_LENGTH && !saving;

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error("Please sign in again to update your profile.");
        return;
      }

      await updateProfile({
        data: {
          preferredName: trimmedName,
          avatar,
          accessToken,
        },
      });

      await refreshUser();
      toast.success("Profile updated.");
      onOpenChange(false);
    } catch {
      toast.error("Could not save your profile. Please try again.");
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
          <SheetTitle className="font-display text-2xl">Edit profile</SheetTitle>
          <SheetDescription>Update how we greet you across Cash Stash.</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Preferred name</Label>
            <Input
              id="profile-name"
              value={preferredName}
              onChange={(e) => setPreferredName(e.target.value)}
              maxLength={PROFILE_NAME_MAX_LENGTH}
              placeholder="What should we call you?"
              className="h-12 rounded-xl text-base"
              autoComplete="nickname"
            />
            <p className="text-xs text-muted-foreground">
              Examples: {PROFILE_NAME_EXAMPLES.join(", ")}
            </p>
          </div>

          <div className="space-y-3">
            <Label>Choose an avatar</Label>
            <AvatarPicker value={avatar} onChange={setAvatar} />
          </div>

          <Button
            size="lg"
            onClick={handleSave}
            disabled={!canSave}
            className="h-14 w-full rounded-2xl text-base font-semibold"
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
