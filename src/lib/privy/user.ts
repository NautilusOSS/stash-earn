import type { User } from "@privy-io/react-auth";

export function getUserEmail(user: User | null | undefined): string | undefined {
  if (!user) return undefined;
  if (user.email?.address) return user.email.address;
  if (user.google?.email) return user.google.email;
  if (user.apple?.email) return user.apple.email;
  return undefined;
}

export function getUserDisplayName(user: User | null | undefined): string {
  if (!user) return "Guest";

  if (user.google?.name) return user.google.name;

  const email = getUserEmail(user);
  if (email) {
    const local = email.split("@")[0] ?? email;
    return local.charAt(0).toUpperCase() + local.slice(1);
  }

  return "Stasher";
}

export function getUserInitials(user: User | null | undefined): string {
  const name = getUserDisplayName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function getLoginMethodLabel(user: User | null | undefined): string {
  if (!user) return "Not signed in";
  if (user.google) return "Google";
  if (user.apple) return "Apple";
  if (user.email) return "Email";
  if (user.wallet) return "Wallet";
  return "Privy";
}
