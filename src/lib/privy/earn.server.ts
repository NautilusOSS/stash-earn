import { formatUnits } from "viem";

import { getServerConfig } from "../config.server";
import { fetchWalletUsdcBalance } from "./usdcBalance";
import type {
  EarnAction,
  EarnDepositResult,
  EarnPosition,
  EarnVaultDetails,
  EarnWithdrawResult,
} from "./earn.types";
import { resolveEmbeddedWalletId, verifyPrivyAccessToken } from "./session.server";

const PRIVY_API_BASE = "https://api.privy.io/api/v1";

function getVaultId(): string {
  const vaultId = getServerConfig().privy.vaultId;
  if (!vaultId) {
    throw new Error(
      "Privy Earn is not configured. Set PRIVY_VAULT_ID from Dashboard → Earn.",
    );
  }
  return vaultId;
}

function getPrivyCredentials() {
  const config = getServerConfig();
  const appId = config.privy.appId;
  const appSecret = config.privy.appSecret;
  if (!appId || !appSecret) {
    throw new Error("Privy is not configured. Set VITE_PRIVY_APP_ID and PRIVY_APP_SECRET.");
  }
  return { appId, appSecret };
}

async function privyApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { appId, appSecret } = getPrivyCredentials();
  const credentials = Buffer.from(`${appId}:${appSecret}`).toString("base64");

  const response = await fetch(`${PRIVY_API_BASE}${path}`, {
    ...options,
    headers: {
      "privy-app-id": appId,
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Privy API ${response.status}: ${body}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
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
  return Boolean(getServerConfig().privy.vaultId);
}

export async function getEarnVaultDetails(): Promise<EarnVaultDetails | null> {
  if (!isEarnConfigured()) return null;
  const vaultId = getVaultId();
  const raw = await privyApi<Record<string, unknown>>(
    `/earn/ethereum/vaults/${encodeURIComponent(vaultId)}`,
  );
  return mapVaultDetails(raw);
}

export async function getEarnPositionForUser(
  accessToken: string,
  evmAddress: string,
): Promise<EarnPosition | null> {
  if (!isEarnConfigured()) return null;

  const { userId } = await verifyPrivyAccessToken(accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, evmAddress);
  const vaultId = getVaultId();

  const raw = await privyApi<Record<string, unknown>>(
    `/wallets/${encodeURIComponent(walletId)}/earn/ethereum/vaults?vault_id=${encodeURIComponent(vaultId)}`,
  );
  return mapPosition(raw);
}

export async function depositToEarnVault(
  accessToken: string,
  evmAddress: string,
  rawAmount: string,
): Promise<EarnDepositResult> {
  const amount = BigInt(rawAmount);
  if (amount <= 0) {
    throw new Error("Deposit amount must be greater than zero.");
  }

  const { userId } = await verifyPrivyAccessToken(accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, evmAddress);
  const vaultId = getVaultId();

  const walletBalance = await fetchWalletUsdcBalance(evmAddress as `0x${string}`);
  const walletAtomic = BigInt(Math.round(walletBalance * 1e6));
  if (amount > walletAtomic) {
    throw new Error("Insufficient USDC balance in your wallet.");
  }

  const raw = await privyApi<Record<string, unknown>>(
    `/wallets/${encodeURIComponent(walletId)}/earn/ethereum/deposit`,
    {
      method: "POST",
      body: JSON.stringify({ vault_id: vaultId, raw_amount: rawAmount }),
    },
  );

  return { action: mapAction(raw) };
}

export async function withdrawFromEarnVault(
  accessToken: string,
  evmAddress: string,
  rawAmount: string,
): Promise<EarnWithdrawResult> {
  const amount = BigInt(rawAmount);
  if (amount <= 0) {
    throw new Error("Withdrawal amount must be greater than zero.");
  }

  const { userId } = await verifyPrivyAccessToken(accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, evmAddress);
  const vaultId = getVaultId();

  const position = await getEarnPositionForUser(accessToken, evmAddress);
  if (!position) {
    throw new Error("Could not load vault position.");
  }

  const inVaultAtomic = BigInt(position.assetsInVaultAtomic);
  if (amount > inVaultAtomic) {
    throw new Error("Withdrawal amount exceeds your vault balance.");
  }

  const raw = await privyApi<Record<string, unknown>>(
    `/wallets/${encodeURIComponent(walletId)}/earn/ethereum/withdraw`,
    {
      method: "POST",
      body: JSON.stringify({ vault_id: vaultId, raw_amount: rawAmount }),
    },
  );

  return { action: mapAction(raw) };
}

export async function getEarnAction(actionId: string): Promise<EarnAction> {
  const raw = await privyApi<Record<string, unknown>>(
    `/wallet_actions/${encodeURIComponent(actionId)}`,
  );
  return mapAction(raw);
}

export async function pollEarnAction(
  actionId: string,
  options: { intervalMs?: number; timeoutMs?: number } = {},
): Promise<EarnAction> {
  const intervalMs = options.intervalMs ?? 2000;
  const timeoutMs = options.timeoutMs ?? 120000;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const action = await getEarnAction(actionId);
    if (action.status !== "pending") {
      return action;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Earn action timed out. Check your wallet activity and try again.");
}
