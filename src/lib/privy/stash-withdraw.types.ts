import type { PrivyWalletActionAuth } from "./wallet-action-auth";

export type StashWithdrawActionId = string;

export type StashWithdrawPreparedAction = {
  id: StashWithdrawActionId;
  path: string;
  body: Record<string, unknown>;
};

/** Exact path/body/auth the client must sign — must be replayed verbatim on execute. */
export type StashWithdrawSignedAction = StashWithdrawPreparedAction & PrivyWalletActionAuth;

export type StashWithdrawAuthMap = Partial<Record<StashWithdrawActionId, PrivyWalletActionAuth>>;

export type StashWithdrawVaultChunk = {
  vaultId: string;
  amount: string;
};

export type StashWithdrawPlan = {
  fromWallet: string;
  fromVault: string;
  fromVoi: string;
  vaultWithdrawals: StashWithdrawVaultChunk[];
};

export type StashWithdrawPrepareResult = {
  destinationAddress: `0x${string}`;
  plan: StashWithdrawPlan;
  actions: StashWithdrawPreparedAction[];
};

export function vaultWithdrawActionId(vaultId: string): string {
  return `vault-withdraw:${vaultId}`;
}

export function vaultTransferActionId(vaultId: string): string {
  return `transfer-vault:${vaultId}`;
}
