import type { PrivyWalletActionAuth } from "./wallet-action-auth";

export type StashWithdrawActionId = "transfer-wallet" | "vault-withdraw" | "transfer-vault";

export type StashWithdrawPreparedAction = {
  id: StashWithdrawActionId;
  path: string;
  body: Record<string, unknown>;
};

/** Exact path/body/auth the client signed — must be replayed verbatim on execute. */
export type StashWithdrawSignedAction = StashWithdrawPreparedAction & PrivyWalletActionAuth;

export type StashWithdrawAuthMap = Partial<Record<StashWithdrawActionId, PrivyWalletActionAuth>>;

export type StashWithdrawPlan = {
  fromWallet: string;
  fromVault: string;
  fromVoi: string;
};

export type StashWithdrawPrepareResult = {
  destinationAddress: `0x${string}`;
  plan: StashWithdrawPlan;
  actions: StashWithdrawPreparedAction[];
};
