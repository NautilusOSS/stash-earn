import { formatUnits } from "viem";

import { getServerConfig } from "../config.server";
import { EARN_VAULTS, getEarnVaultById, resolveEarnVaultId } from "./vaults";
import { fetchWalletUsdcBalance } from "./usdcBalance";
import type {
  EarnAction,
  EarnActionStatus,
  EarnDepositResult,
  EarnPosition,
  EarnVaultDetails,
  EarnWithdrawResult,
} from "./earn.types";
import {
  privyApiGet,
  privyWalletAction,
  type PrivyAuthorizationContext,
} from "./privy-api.server";
import { resolveEmbeddedWalletId, verifyPrivyAccessToken } from "./session.server";
import type { PrivyWalletActionAuth } from "./wallet-action-auth";

function getVaultId(vaultId?: string): string {
  const resolved = resolveEarnVaultId(vaultId ?? getServerConfig().privy.vaultId);
  if (vaultId && !getEarnVaultById(resolved)) {
    throw new Error(`Unknown earn vault: ${resolved}`);
  }
  return resolved;
}

function atomicToNumber(raw: string, decimals: number): number {
  try {
    return Number(formatUnits(BigInt(raw), decimals));
  } catch {
    return 0;
  }
}

function mapVaultDetails(raw: Record<string, unknown>): EarnVaultDetails {
  const asset = raw.asset as Record<string, unknown>;
  return {
    id: String(raw.id),
    name: String(raw.name),
    provider: String(raw.provider),
    vaultAddress: String(raw.vault_address),
    asset: {
      address: String(asset.address),
      symbol: String(asset.symbol),
      decimals: Number(asset.decimals),
    },
    caip2: String(raw.caip2),
    userApyBps: raw.user_apy == null ? null : Number(raw.user_apy),
    appApyBps: raw.app_apy == null ? null : Number(raw.app_apy),
    tvlUsd: raw.tvl_usd == null ? null : Number(raw.tvl_usd),
    availableLiquidityUsd:
      raw.available_liquidity_usd == null ? null : Number(raw.available_liquidity_usd),
  };
}

function mapPosition(raw: Record<string, unknown>): EarnPosition {
  const asset = raw.asset as Record<string, unknown>;
  const decimals = Number(asset.decimals);
  const totalDepositedAtomic = String(raw.total_deposited ?? "0");
  const totalWithdrawnAtomic = String(raw.total_withdrawn ?? "0");
  const assetsInVaultAtomic = String(raw.assets_in_vault ?? "0");

  const totalDeposited = atomicToNumber(totalDepositedAtomic, decimals);
  const totalWithdrawn = atomicToNumber(totalWithdrawnAtomic, decimals);
  const assetsInVault = atomicToNumber(assetsInVaultAtomic, decimals);
  const netContributions = totalDeposited - totalWithdrawn;

  return {
    asset: {
      address: String(asset.address),
      symbol: String(asset.symbol),
      decimals,
    },
    totalDepositedAtomic,
    totalWithdrawnAtomic,
    assetsInVaultAtomic,
    sharesInVault: String(raw.shares_in_vault ?? "0"),
    assetsInVault,
    totalDeposited,
    totalWithdrawn,
    earnedYield: assetsInVault - netContributions,
  };
}

function mapAction(raw: Record<string, unknown>): EarnAction {
  return {
    id: String(raw.id),
    walletId: String(raw.wallet_id),
    type: raw.type as EarnAction["type"],
    status: raw.status as EarnAction["status"],
    caip2: String(raw.caip2),
    vaultId: String(raw.vault_id),
    vaultAddress: String(raw.vault_address),
    assetAddress: String(raw.asset_address),
    rawAmount: String(raw.raw_amount),
    amount: raw.amount == null ? null : String(raw.amount),
    asset: raw.asset == null ? null : String(raw.asset),
    decimals: raw.decimals == null ? null : Number(raw.decimals),
    shareAmount: raw.share_amount == null ? null : String(raw.share_amount),
    createdAt: String(raw.created_at),
  };
}

export function isEarnConfigured(): boolean {
  return Boolean(resolveEarnVaultId(getServerConfig().privy.vaultId));
}

export async function getEarnVaultDetails(vaultId?: string): Promise<EarnVaultDetails | null> {
  if (!isEarnConfigured()) return null;
  const id = getVaultId(vaultId);
  const raw = await privyApiGet<Record<string, unknown>>(
    `/earn/ethereum/vaults/${encodeURIComponent(id)}`,
  );
  return mapVaultDetails(raw);
}

export async function getEarnPositionForUser(
  accessToken: string,
  evmAddress: string,
  vaultId?: string,
): Promise<EarnPosition | null> {
  if (!isEarnConfigured()) return null;

  const { userId } = await verifyPrivyAccessToken(accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, evmAddress);
  const id = getVaultId(vaultId);

  const raw = await privyApiGet<Record<string, unknown>>(
    `/wallets/${encodeURIComponent(walletId)}/earn/ethereum/vaults?vault_id=${encodeURIComponent(id)}`,
  );
  return mapPosition(raw);
}

export async function depositToEarnVault(
  accessToken: string,
  evmAddress: string,
  rawAmount: string,
  authCtx?: PrivyAuthorizationContext,
  clientAuth?: PrivyWalletActionAuth,
  signedBody?: Record<string, unknown>,
  vaultId?: string,
): Promise<EarnDepositResult> {
  const amount = BigInt(rawAmount);
  if (amount <= 0) {
    throw new Error("Deposit amount must be greater than zero.");
  }

  const { userId } = await verifyPrivyAccessToken(accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, evmAddress);
  const id = getVaultId(vaultId);

  const walletBalance = await fetchWalletUsdcBalance(evmAddress as `0x${string}`);
  const walletAtomic = BigInt(Math.round(walletBalance * 1e6));
  if (amount > walletAtomic) {
    throw new Error("Insufficient USDC balance in your wallet.");
  }

  const raw = await privyWalletAction<Record<string, unknown>>(
    `/wallets/${encodeURIComponent(walletId)}/earn/ethereum/deposit`,
    accessToken,
    signedBody ?? { vault_id: id, raw_amount: rawAmount },
    authCtx,
    clientAuth,
  );

  return { action: mapAction(raw) };
}

export async function withdrawFromEarnVault(
  accessToken: string,
  evmAddress: string,
  rawAmount: string,
  authCtx?: PrivyAuthorizationContext,
  clientAuth?: PrivyWalletActionAuth,
  signedBody?: Record<string, unknown>,
  vaultId?: string,
): Promise<EarnWithdrawResult> {
  const amount = BigInt(rawAmount);
  if (amount <= 0) {
    throw new Error("Withdrawal amount must be greater than zero.");
  }

  const { userId } = await verifyPrivyAccessToken(accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, evmAddress);
  const id = getVaultId(vaultId);

  const position = await getEarnPositionForUser(accessToken, evmAddress, id);
  if (!position) {
    throw new Error("Could not load vault position.");
  }

  const inVaultAtomic = BigInt(position.assetsInVaultAtomic);
  if (amount > inVaultAtomic) {
    throw new Error("Withdrawal amount exceeds your vault balance.");
  }

  const vaultDetails = await getEarnVaultDetails(id);
  if (vaultDetails?.availableLiquidityUsd != null) {
    const withdrawUsd = atomicToNumber(rawAmount, position.asset.decimals);
    if (withdrawUsd > vaultDetails.availableLiquidityUsd) {
      throw new Error(
        "Vault liquidity is temporarily limited. Try a smaller amount or try again later.",
      );
    }
  }

  const raw = await privyWalletAction<Record<string, unknown>>(
    `/wallets/${encodeURIComponent(walletId)}/earn/ethereum/withdraw`,
    accessToken,
    signedBody ?? { vault_id: id, raw_amount: rawAmount },
    authCtx,
    clientAuth,
  );

  return { action: mapAction(raw) };
}

export type EarnVaultBalance = {
  vaultId: string;
  atomic: bigint;
};

export async function getAllEarnVaultBalances(
  accessToken: string,
  evmAddress: string,
): Promise<EarnVaultBalance[]> {
  const balances = await Promise.all(
    EARN_VAULTS.map(async (vault) => {
      const position = await getEarnPositionForUser(accessToken, evmAddress, vault.id);
      return {
        vaultId: vault.id,
        atomic: BigInt(position?.assetsInVaultAtomic ?? "0"),
      };
    }),
  );

  return balances.filter((entry) => entry.atomic > 0n);
}

/** Return the wallet API payload the client must sign before depositing. */
export async function prepareEarnDeposit(
  accessToken: string,
  evmAddress: string,
  rawAmount: string,
  vaultId?: string,
): Promise<{ path: string; body: Record<string, unknown> }> {
  const amount = BigInt(rawAmount);
  if (amount <= 0) {
    throw new Error("Deposit amount must be greater than zero.");
  }

  const { userId } = await verifyPrivyAccessToken(accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, evmAddress);
  const id = getVaultId(vaultId);

  return {
    path: `/wallets/${encodeURIComponent(walletId)}/earn/ethereum/deposit`,
    body: { vault_id: id, raw_amount: rawAmount },
  };
}

function walletActionPath(walletId: string, actionId: string, includeSteps = false): string {
  const base = `/wallets/${encodeURIComponent(walletId)}/actions/${encodeURIComponent(actionId)}`;
  return includeSteps ? `${base}?include=steps` : base;
}

export function walletActionFailureMessage(
  raw: Record<string, unknown>,
  fallback: string,
): string {
  const reason = raw.failure_reason;
  if (reason && typeof reason === "object" && "message" in reason) {
    const message = (reason as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }
  return fallback;
}

export async function getWalletActionRaw(
  walletId: string,
  actionId: string,
  includeSteps = false,
): Promise<Record<string, unknown>> {
  return privyApiGet<Record<string, unknown>>(walletActionPath(walletId, actionId, includeSteps));
}

export async function getEarnAction(
  walletId: string,
  actionId: string,
): Promise<EarnAction> {
  const raw = await getWalletActionRaw(walletId, actionId);
  return mapAction(raw);
}

function isWalletActionInProgress(status: string): boolean {
  return status === "pending" || status === "created";
}

export async function pollEarnAction(
  walletId: string,
  actionId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<EarnAction> {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 120000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const action = await getEarnAction(walletId, actionId);
    if (!isWalletActionInProgress(action.status)) {
      return action;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Earn action timed out. Check your wallet activity and try again.");
}

export async function pollWalletAction(
  walletId: string,
  actionId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<Record<string, unknown>> {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 120000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const raw = await getWalletActionRaw(walletId, actionId);
    const status = raw.status as EarnActionStatus;
    if (!isWalletActionInProgress(status)) {
      return raw;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Wallet action timed out. Check your activity and try again.");
}

export async function pollWalletActionStatus(
  walletId: string,
  actionId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<EarnActionStatus> {
  const raw = await pollWalletAction(walletId, actionId, options);
  return raw.status as EarnActionStatus;
}
