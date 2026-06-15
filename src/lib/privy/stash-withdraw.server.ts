import { formatUnits } from "viem";

import { deriveXChainAddresses } from "@/lib/xchain/derive.server";
import { fetchWalletUsdcBalanceAtomic } from "@/lib/privy/usdcBalance";
import {
  planWithdrawal,
  totalWithdrawableAtomic,
  walletPlusVaultAtomic,
  type WithdrawBalanceBuckets,
} from "@/lib/stash/withdraw-plan";
import { getAvmUsdcHolding } from "@/lib/voi/avm-usdc-balance.server";

import type { PrivyAuthorizationContext } from "./privy-api.server";
import {
  getAllEarnVaultBalances,
  pollEarnAction,
  pollWalletAction,
  walletActionFailureMessage,
  withdrawFromEarnVault,
  type EarnVaultBalance,
} from "./earn.server";
import type { EarnAction, WalletAction } from "./earn.types";
import { resolveEmbeddedWalletId, verifyPrivyAccessToken } from "./session.server";
import { mapWalletAction, transferUsdcOnBase } from "./transfer.server";
import { buildUsdcTransferBody } from "./transfer-body";
import { getServerConfig } from "../config.server";
import { EARN_VAULTS } from "./vaults";
import {
  vaultTransferActionId,
  vaultWithdrawActionId,
} from "./stash-withdraw.types";

export type StashWithdrawExecutionResult = {
  destinationAddress: `0x${string}`;
  withdrawAction: EarnAction | null;
  transferActions: WalletAction[];
  plan: StashWithdrawPlan;
};

export type {
  StashWithdrawActionId,
  StashWithdrawAuthMap,
  StashWithdrawPrepareResult,
  StashWithdrawSignedAction,
} from "./stash-withdraw.types";

import type {
  StashWithdrawActionId,
  StashWithdrawPlan,
  StashWithdrawPrepareResult,
  StashWithdrawPreparedAction,
  StashWithdrawSignedAction,
} from "./stash-withdraw.types";

async function loadWithdrawBuckets(
  accessToken: string,
  evmAddress: string,
): Promise<WithdrawBalanceBuckets> {
  const [walletAtomic, vaultBalances, addresses] = await Promise.all([
    fetchWalletUsdcBalanceAtomic(evmAddress as `0x${string}`),
    getAllEarnVaultBalances(accessToken, evmAddress),
    deriveXChainAddresses(evmAddress),
  ]);

  const vaultAtomic = vaultBalances.reduce((sum, entry) => sum + entry.atomic, 0n);
  const voiHolding = await getAvmUsdcHolding(addresses.voiExecutionAddress);
  const voiAtomic = BigInt(voiHolding?.amountAtomic ?? "0");

  return { walletAtomic, vaultAtomic, voiAtomic };
}

function planVaultWithdrawals(
  fromVault: bigint,
  vaultBalances: EarnVaultBalance[],
): { vaultId: string; amount: bigint }[] {
  let remaining = fromVault;
  const chunks: { vaultId: string; amount: bigint }[] = [];

  for (const vault of EARN_VAULTS) {
    const balance = vaultBalances.find((entry) => entry.vaultId === vault.id);
    if (!balance || balance.atomic <= 0n || remaining <= 0n) continue;

    const take = remaining < balance.atomic ? remaining : balance.atomic;
    chunks.push({ vaultId: vault.id, amount: take });
    remaining -= take;
  }

  return chunks;
}

function transferBody(
  destinationAddress: `0x${string}`,
  amountAtomic: bigint,
): Record<string, unknown> {
  return buildUsdcTransferBody(destinationAddress, amountAtomic);
}

async function waitForWalletUsdc(
  evmAddress: `0x${string}`,
  minAtomic: bigint,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const balance = await fetchWalletUsdcBalanceAtomic(evmAddress);
    if (balance >= minAtomic) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error("Vault USDC has not settled in your wallet yet. Try again in a moment.");
}

function signedActionLookup(
  signedActions: StashWithdrawSignedAction[] | undefined,
  actionId: StashWithdrawActionId,
): StashWithdrawSignedAction | undefined {
  return signedActions?.find((action) => action.id === actionId);
}

function transferFailureMessage(raw: Record<string, unknown>): string {
  return walletActionFailureMessage(
    raw,
    "Transfer to your withdraw address was rejected.",
  );
}

async function buildWithdrawActions(
  accessToken: string,
  evmAddress: string,
  rawAmount: string,
  destinationAddress: `0x${string}`,
): Promise<{ plan: StashWithdrawPlan; actions: StashWithdrawPreparedAction[] }> {
  const requestedAtomic = BigInt(rawAmount);
  const buckets = await loadWithdrawBuckets(accessToken, evmAddress);
  const withdrawalPlan = planWithdrawal(requestedAtomic, buckets);
  const vaultBalances = await getAllEarnVaultBalances(accessToken, evmAddress);
  const vaultWithdrawals = planVaultWithdrawals(withdrawalPlan.fromVault, vaultBalances);

  if (withdrawalPlan.fromVoi > 0n) {
    const baseCap = walletPlusVaultAtomic(buckets);
    const baseCapLabel = formatUnits(baseCap, 6);
    const voiLabel = formatUnits(withdrawalPlan.fromVoi, 6);
    throw new Error(
      `Your withdrawal includes $${voiLabel} from Voi, which can't be sent to Base automatically yet. Try up to $${baseCapLabel} (Base wallet + yield vault).`,
    );
  }

  const { userId } = await verifyPrivyAccessToken(accessToken);
  const walletId = await resolveEmbeddedWalletId(userId, evmAddress);
  const walletPath = `/wallets/${encodeURIComponent(walletId)}/transfer`;
  const vaultWithdrawPath = `/wallets/${encodeURIComponent(walletId)}/earn/ethereum/withdraw`;

  const actions: StashWithdrawPreparedAction[] = [];

  if (withdrawalPlan.fromWallet > 0n) {
    actions.push({
      id: "transfer-wallet",
      path: walletPath,
      body: transferBody(destinationAddress, withdrawalPlan.fromWallet),
    });
  }

  for (const chunk of vaultWithdrawals) {
    actions.push({
      id: vaultWithdrawActionId(chunk.vaultId),
      path: vaultWithdrawPath,
      body: { vault_id: chunk.vaultId, raw_amount: chunk.amount.toString() },
    });
    actions.push({
      id: vaultTransferActionId(chunk.vaultId),
      path: walletPath,
      body: transferBody(destinationAddress, chunk.amount),
    });
  }

  return {
    plan: {
      fromWallet: withdrawalPlan.fromWallet.toString(),
      fromVault: withdrawalPlan.fromVault.toString(),
      fromVoi: withdrawalPlan.fromVoi.toString(),
      vaultWithdrawals: vaultWithdrawals.map((chunk) => ({
        vaultId: chunk.vaultId,
        amount: chunk.amount.toString(),
      })),
    },
    actions,
  };
}

/** Return wallet API payloads the client must sign before executing a withdraw. */
export async function prepareStashWithdraw(
  accessToken: string,
  evmAddress: string,
  rawAmount: string,
  destinationAddress: `0x${string}`,
): Promise<StashWithdrawPrepareResult> {
  const { plan, actions } = await buildWithdrawActions(
    accessToken,
    evmAddress,
    rawAmount,
    destinationAddress,
  );

  return { destinationAddress, plan, actions };
}

async function transferAtomic(
  accessToken: string,
  evmAddress: string,
  destinationAddress: `0x${string}`,
  amountAtomic: bigint,
  authCtx: PrivyAuthorizationContext,
  signedAction?: StashWithdrawSignedAction,
): Promise<WalletAction> {
  const rawAmount = amountAtomic.toString();
  const result = await transferUsdcOnBase(
    accessToken,
    evmAddress,
    destinationAddress,
    rawAmount,
    authCtx,
    signedAction
      ? {
          authorizationSignature: signedAction.authorizationSignature,
          requestExpiry: signedAction.requestExpiry,
        }
      : undefined,
    signedAction?.body,
  );

  const raw = await pollWalletAction(result.action.walletId, result.action.id);
  const action = mapWalletAction(raw);
  if (action.status === "rejected") {
    throw new Error(transferFailureMessage(raw));
  }
  if (action.status === "failed") {
    throw new Error(
      walletActionFailureMessage(raw, "Transfer to your withdraw address failed onchain."),
    );
  }
  return action;
}

function requireSignedAction(
  signedActions: StashWithdrawSignedAction[] | undefined,
  actionId: StashWithdrawActionId,
): StashWithdrawSignedAction | undefined {
  const config = getServerConfig();
  if (config.privy.authorizationPrivateKey) {
    return undefined;
  }
  const signed = signedActionLookup(signedActions, actionId);
  if (!signed) {
    throw new Error(`Missing signed authorization for ${actionId}.`);
  }
  return signed;
}

/**
 * Withdraw USDC to a Base address using wallet → vault → Voi priority.
 * Voi balance is included in availability but not yet executable on Base.
 */
export async function executeStashWithdraw(
  accessToken: string,
  evmAddress: string,
  rawAmount: string,
  destinationAddress: `0x${string}`,
  signedActions?: StashWithdrawSignedAction[],
): Promise<StashWithdrawExecutionResult> {
  const { plan } = await buildWithdrawActions(
    accessToken,
    evmAddress,
    rawAmount,
    destinationAddress,
  );

  const transferActions: WalletAction[] = [];
  let withdrawAction: EarnAction | null = null;
  const authCtx: PrivyAuthorizationContext = {};

  const fromWallet = BigInt(plan.fromWallet);
  const fromVault = BigInt(plan.fromVault);

  if (fromWallet > 0n) {
    transferActions.push(
      await transferAtomic(
        accessToken,
        evmAddress,
        destinationAddress,
        fromWallet,
        authCtx,
        requireSignedAction(signedActions, "transfer-wallet"),
      ),
    );
  }

  if (fromVault > 0n) {
    const vaultBalances = await getAllEarnVaultBalances(accessToken, evmAddress);
    const vaultWithdrawals = planVaultWithdrawals(fromVault, vaultBalances);

    for (const chunk of vaultWithdrawals) {
      const vaultRaw = chunk.amount.toString();
      const vaultSigned = requireSignedAction(
        signedActions,
        vaultWithdrawActionId(chunk.vaultId),
      );
      const withdrawResult = await withdrawFromEarnVault(
        accessToken,
        evmAddress,
        vaultRaw,
        authCtx,
        vaultSigned
          ? {
              authorizationSignature: vaultSigned.authorizationSignature,
              requestExpiry: vaultSigned.requestExpiry,
            }
          : undefined,
        vaultSigned?.body,
        chunk.vaultId,
      );
      const chunkAction = await pollEarnAction(
        withdrawResult.action.walletId,
        withdrawResult.action.id,
      );
      withdrawAction = chunkAction;

      if (chunkAction.status === "failed" || chunkAction.status === "rejected") {
        return {
          destinationAddress,
          withdrawAction,
          transferActions,
          plan,
        };
      }

      await waitForWalletUsdc(evmAddress as `0x${string}`, chunk.amount);

      transferActions.push(
        await transferAtomic(
          accessToken,
          evmAddress,
          destinationAddress,
          chunk.amount,
          authCtx,
          requireSignedAction(signedActions, vaultTransferActionId(chunk.vaultId)),
        ),
      );
    }
  }

  return {
    destinationAddress,
    withdrawAction,
    transferActions,
    plan,
  };
}

export async function getStashWithdrawBuckets(
  accessToken: string,
  evmAddress: string,
): Promise<WithdrawBalanceBuckets & { totalAtomic: string }> {
  const buckets = await loadWithdrawBuckets(accessToken, evmAddress);
  return {
    ...buckets,
    totalAtomic: totalWithdrawableAtomic(buckets).toString(),
  };
}
