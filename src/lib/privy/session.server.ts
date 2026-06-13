import type { User } from "@privy-io/server-auth";

import { getPrivyClient } from "./privy.server";

export async function verifyPrivyAccessToken(accessToken: string) {
  const privy = getPrivyClient();
  return privy.verifyAuthToken(accessToken);
}

function isEmbeddedWalletAccount(
  account: User["linkedAccounts"][number],
): account is User["linkedAccounts"][number] & {
  type: "wallet";
  address: string;
  walletClientType?: string;
  id?: string | null;
} {
  return (
    account.type === "wallet" &&
    (account.walletClientType === "privy" || account.walletClientType === "privy-v2")
  );
}

/** Resolve Privy wallet ID for the user's embedded EVM wallet. */
export async function resolveEmbeddedWalletId(
  userId: string,
  expectedAddress?: string,
): Promise<string> {
  const privy = getPrivyClient();
  const user = await privy.getUserById(userId);

  const embedded = user.linkedAccounts.find(isEmbeddedWalletAccount);
  if (embedded?.id) {
    if (
      expectedAddress &&
      embedded.address.toLowerCase() !== expectedAddress.toLowerCase()
    ) {
      throw new Error("Wallet address does not match your account.");
    }
    return embedded.id;
  }

  if (expectedAddress) {
    const wallets = await privy.walletApi.getWallets({ chainType: "ethereum" });
    const match = wallets.data.find(
      (wallet) => wallet.address.toLowerCase() === expectedAddress.toLowerCase(),
    );
    if (match) return match.id;
  }

  throw new Error(
    "Embedded wallet not found. Sign in again or contact support if this persists.",
  );
}
