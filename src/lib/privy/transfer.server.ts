import type { WalletAction } from "./earn.types";
import type { PrivyWalletActionAuth } from "./wallet-action-auth";
import { privyWalletAction, type PrivyAuthorizationContext } from "./privy-api.server";
import { buildUsdcTransferBody } from "./transfer-body";
import { resolveEmbeddedWalletId, verifyPrivyAccessToken } from "./session.server";

function mapWalletAction(raw: Record<string, unknown>): WalletAction {
  return {
    id: String(raw.id),
    walletId: String(raw.wallet_id),
    type: String(raw.type),
    status: raw.status as WalletAction["status"],
    createdAt: raw.created_at == null ? "" : String(raw.created_at),
    destinationAddress:
      raw.destination_address == null ? null : String(raw.destination_address),
    sourceAmount: raw.source_amount == null ? null : String(raw.source_amount),
    sourceChain: raw.source_chain == null ? null : String(raw.source_chain),
  };
}

/** Send Base USDC from the user's embedded wallet to a destination address. */
export async function transferUsdcOnBase(
  accessToken: string,
  evmAddress: string,
  destinationAddress: `0x${string}`,
  rawAmount: string,
  authCtx?: PrivyAuthorizationContext,
  clientAuth?: PrivyWalletActionAuth,
  signedBody?: Record<string, unknown>,
): Promise<{ action: WalletAction }> {
  const amount = BigInt(rawAmount);
  if (amount <= 0n) {
    throw new Error("Transfer amount must be greater than zero.");
  }

  const { userId } = await verifyPrivyAccessToken(accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, evmAddress);
  const body = signedBody ?? buildUsdcTransferBody(destinationAddress, amount);

  const raw = await privyWalletAction<Record<string, unknown>>(
    `/wallets/${encodeURIComponent(walletId)}/transfer`,
    accessToken,
    body,
    authCtx,
    clientAuth,
  );

  return { action: mapWalletAction(raw) };
}

export { mapWalletAction };
