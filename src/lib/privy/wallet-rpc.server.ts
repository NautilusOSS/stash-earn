import type { SignTypedDataParams } from "@/lib/xchain/types";

import {
  privyWalletAction,
  type PrivyAuthorizationContext,
} from "./privy-api.server";
import type { PrivyWalletActionAuth } from "./wallet-action-auth";
import { resolveEmbeddedWalletId, verifyPrivyAccessToken } from "./session.server";

export function toPrivyRpcTypedData(typedData: SignTypedDataParams) {
  return {
    domain: typedData.domain,
    types: {
      EIP712Domain: [...typedData.types.EIP712Domain],
      "Algorand Transaction": [...typedData.types["Algorand Transaction"]],
    },
    message: typedData.message,
    primary_type: typedData.primaryType,
  };
}

export function buildXChainRpcWalletAction(
  walletId: string,
  typedData: SignTypedDataParams,
): { path: string; body: Record<string, unknown> } {
  return {
    path: `/wallets/${encodeURIComponent(walletId)}/rpc`,
    body: {
      method: "eth_signTypedData_v4",
      params: {
        typed_data: toPrivyRpcTypedData(typedData),
      },
    },
  };
}

export async function resolveXChainRpcWalletAction(params: {
  accessToken: string;
  evmAddress: string;
  typedData: SignTypedDataParams;
}): Promise<{ path: string; body: Record<string, unknown> }> {
  const { userId } = await verifyPrivyAccessToken(params.accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, params.evmAddress);
  return buildXChainRpcWalletAction(walletId, params.typedData);
}

type PrivyRpcSignatureResponse = {
  data?: { signature?: string };
  signature?: string;
  result?: string;
};

/** Sign xChain EIP-712 typed data via Privy Wallet API (no user wallet prompt). */
export async function signXChainTypedDataWithPrivy(params: {
  accessToken: string;
  evmAddress: string;
  typedData: SignTypedDataParams;
  authCtx?: PrivyAuthorizationContext;
  clientAuth?: PrivyWalletActionAuth;
  /** Must match the request the client signed when clientAuth is set. */
  rpcPath?: string;
  rpcBody?: Record<string, unknown>;
}): Promise<string> {
  const rpc =
    params.rpcPath && params.rpcBody
      ? { path: params.rpcPath, body: params.rpcBody }
      : await resolveXChainRpcWalletAction({
          accessToken: params.accessToken,
          evmAddress: params.evmAddress,
          typedData: params.typedData,
        });
  const authCtx = params.authCtx ?? {};

  const response = await privyWalletAction<PrivyRpcSignatureResponse>(
    rpc.path,
    params.accessToken,
    rpc.body,
    authCtx,
    params.clientAuth,
  );

  const signature = response.data?.signature ?? response.signature ?? response.result;
  if (!signature) {
    throw new Error("Privy did not return a signature for the Voi transaction.");
  }

  return signature;
}
