import type { User } from "@privy-io/react-auth";

export const PROFILE_AVATARS = ["🌻", "😀", "🚀", "🏖️", "🐶", "🌲", "☕", "❤️"] as const;

export const PROFILE_NAME_MAX_LENGTH = 30;

export const PROFILE_NAME_EXAMPLES = ["Mom", "Dad", "Nick", "Grandma", "Sarah"];

export interface UserProfile {
  preferredName?: string;
  avatar?: string;
}

export function getUserProfile(user: User | null | undefined): UserProfile {
  if (!user?.customMetadata) return {};

  const metadata = user.customMetadata as Record<string, unknown>;
  const preferredName =
    typeof metadata.preferredName === "string" ? metadata.preferredName.trim() : undefined;
  const avatar = typeof metadata.avatar === "string" ? metadata.avatar : undefined;

  return { preferredName, avatar };
}

export function getPreferredName(user: User | null | undefined): string | undefined {
  const name = getUserProfile(user).preferredName;
  return name && name.length > 0 ? name : undefined;
}

export function hasCompletedProfile(user: User | null | undefined): boolean {
  return !!getPreferredName(user);
}

export function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
