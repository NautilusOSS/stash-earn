export type EarnAsset = {
  address: string;
  symbol: string;
  decimals: number;
};

export type EarnVaultDetails = {
  id: string;
  name: string;
  provider: string;
  vaultAddress: string;
  asset: EarnAsset;
  caip2: string;
  /** APY in basis points (500 = 5%). */
  userApyBps: number | null;
  appApyBps: number | null;
  tvlUsd: number | null;
  availableLiquidityUsd: number | null;
};

export type EarnPosition = {
  asset: EarnAsset;
  totalDepositedAtomic: string;
  totalWithdrawnAtomic: string;
  assetsInVaultAtomic: string;
  sharesInVault: string;
  assetsInVault: number;
  totalDeposited: number;
  totalWithdrawn: number;
  earnedYield: number;
};

export type EarnActionStatus =
  | "pending"
  | "created"
  | "succeeded"
  | "failed"
  | "rejected";

export type EarnActionType = "earn_deposit" | "earn_withdraw";

export type EarnAction = {
  id: string;
  walletId: string;
  type: EarnActionType;
  status: EarnActionStatus;
  caip2: string;
  vaultId: string;
  vaultAddress: string;
  assetAddress: string;
  rawAmount: string;
  amount: string | null;
  asset: string | null;
  decimals: number | null;
  shareAmount: string | null;
  createdAt: string;
};

export type EarnDepositResult = {
  action: EarnAction;
};

export type EarnWithdrawResult = {
  action: EarnAction;
};

export type WalletActionStatus =
  | "pending"
  | "created"
  | "succeeded"
  | "failed"
  | "rejected";

export type WalletAction = {
  id: string;
  walletId: string;
  type: string;
  status: WalletActionStatus;
  createdAt: string;
  destinationAddress: string | null;
  sourceAmount: string | null;
  sourceChain: string | null;
};

export type StashWithdrawResult = {
  withdrawAction: EarnAction;
  transferAction: WalletAction;
  destinationAddress: `0x${string}`;
};
