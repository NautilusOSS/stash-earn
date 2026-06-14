import { getPrivyClient } from "./privy.server";
import { verifyPrivyAccessToken } from "./session.server";
import { validateEvmAddress } from "@/lib/xchain/validate";

export async function mergeCustomMetadata(
  userId: string,
  patch: Record<string, string>,
): Promise<void> {
  const privy = getPrivyClient();
  const user = await privy.getUserById(userId);
  const existing = (user.customMetadata ?? {}) as Record<string, string>;
  await privy.setCustomMetadata(userId, { ...existing, ...patch });
}

export function parseWithdrawAddress(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return null;
  const raw = metadata.withdrawAddress;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const validation = validateEvmAddress(raw);
  return validation.valid ? validation.normalized : null;
}

export async function getUserWithdrawAddress(userId: string) {
  const privy = getPrivyClient();
  const user = await privy.getUserById(userId);
  return parseWithdrawAddress(user.customMetadata as Record<string, unknown> | undefined);
}

export async function requireUserWithdrawAddress(accessToken: string) {
  const { userId } = await verifyPrivyAccessToken(accessToken);
  const address = await getUserWithdrawAddress(userId);
  if (!address) {
    throw new Error(
      "Set a Base withdraw address in Account before withdrawing.",
    );
  }
  return address;
}
