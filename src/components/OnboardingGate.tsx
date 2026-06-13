import { usePrivy, useUser } from "@privy-io/react-auth";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { updateProfile } from "@/lib/api/profile.functions";
import {
  hasCompletedProfile,
  PROFILE_NAME_EXAMPLES,
  PROFILE_NAME_MAX_LENGTH,
} from "@/lib/privy/profile";

import { AvatarPicker } from "./AvatarPicker";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="h-8 w-8 animate-pulse rounded-full bg-secondary" />
    </div>
  );
}

function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return (
    <OnboardingLayout>
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Cash Stash</p>
      <h1 className="font-display mt-3 text-5xl leading-tight">Welcome to Cash Stash</h1>
      <p className="mt-4 text-base text-muted-foreground">
        Grow your savings with USDC and earn yield automatically.
      </p>

      <Button
        size="lg"
        onClick={onContinue}
        className="mt-8 h-14 w-full rounded-2xl text-base font-semibold"
      >
        Get Started
      </Button>
    </OnboardingLayout>
  );
}

function ProfileStep({
  onComplete,
}: {
  onComplete: (preferredName: string, avatar?: string) => void;
}) {
  const { getAccessToken } = usePrivy();
  const { refreshUser } = useUser();

  const [preferredName, setPreferredName] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const trimmedName = preferredName.trim();
  const canContinue =
    trimmedName.length > 0 && trimmedName.length <= PROFILE_NAME_MAX_LENGTH && !saving;

  const handleContinue = async () => {
    if (!canContinue) return;

    setSaving(true);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        toast.error("Please sign in again to continue.");
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
      onComplete(trimmedName, avatar);
    } catch {
      toast.error("Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingLayout>
      <h1 className="font-display text-4xl leading-tight">What should we call you?</h1>
      <p className="mt-3 text-base text-muted-foreground">
        Pick a name your family will recognize — we&apos;ll use it to greet you every day.
      </p>

      <div className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="onboarding-name">Preferred name</Label>
          <Input
            id="onboarding-name"
            value={preferredName}
            onChange={(e) => setPreferredName(e.target.value)}
            maxLength={PROFILE_NAME_MAX_LENGTH}
            placeholder="Preferred name"
            className="h-12 rounded-xl text-base"
            autoComplete="nickname"
            required
          />
          <p className="text-xs text-muted-foreground">
            Examples: {PROFILE_NAME_EXAMPLES.join(", ")}
          </p>
        </div>

        <div className="space-y-3">
          <Label>Choose an avatar</Label>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>
      </div>

      <Button
        size="lg"
        onClick={handleContinue}
        disabled={!canContinue}
        className="mt-8 h-14 w-full rounded-2xl text-base font-semibold"
      >
        {saving ? "Saving…" : "Continue"}
      </Button>
    </OnboardingLayout>
  );
}

function SuccessStep({
  preferredName,
  avatar,
  onContinue,
}: {
  preferredName: string;
  avatar?: string;
  onContinue: () => void;
}) {
  return (
    <OnboardingLayout>
      <div className="text-center">
        <p className="text-5xl">{avatar ?? "✨"}</p>
        <h1 className="font-display mt-4 text-4xl leading-tight">Welcome, {preferredName}!</h1>
        <p className="mt-3 text-base text-muted-foreground">Your account is ready.</p>
      </div>

      <Button
        size="lg"
        onClick={onContinue}
        className="mt-8 h-14 w-full rounded-2xl text-base font-semibold"
      >
        View My Savings
      </Button>
    </OnboardingLayout>
  );
}

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { ready, authenticated, login, user } = usePrivy();
  const [showSuccess, setShowSuccess] = useState(false);
  const [successProfile, setSuccessProfile] = useState<{
    preferredName: string;
    avatar?: string;
  }>();

  if (!ready) {
    return <LoadingScreen />;
  }

  if (!authenticated) {
    return <WelcomeStep onContinue={login} />;
  }

  if (showSuccess && successProfile) {
    return (
      <SuccessStep
        preferredName={successProfile.preferredName}
        avatar={successProfile.avatar}
        onContinue={() => setShowSuccess(false)}
      />
    );
  }

  if (!hasCompletedProfile(user)) {
    return (
      <ProfileStep
        onComplete={(preferredName, avatar) => {
          setSuccessProfile({ preferredName, avatar });
          setShowSuccess(true);
        }}
      />
    );
  }

  return children;
}
