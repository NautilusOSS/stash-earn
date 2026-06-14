export type WithdrawBalanceBuckets = {
  walletAtomic: bigint;
  vaultAtomic: bigint;
  voiAtomic: bigint;
};

export type WithdrawPlan = {
  fromWallet: bigint;
  fromVault: bigint;
  fromVoi: bigint;
};

export function totalWithdrawableAtomic(buckets: WithdrawBalanceBuckets): bigint {
  return buckets.walletAtomic + buckets.vaultAtomic + buckets.voiAtomic;
}

/** Consume wallet balance first, then vault, then Voi. */
export function planWithdrawal(
  requestedAtomic: bigint,
  buckets: WithdrawBalanceBuckets,
): WithdrawPlan {
  if (requestedAtomic <= 0n) {
    throw new Error("Withdrawal amount must be greater than zero.");
  }

  const total = totalWithdrawableAtomic(buckets);
  if (requestedAtomic > total) {
    throw new Error("Withdrawal amount exceeds your available balance.");
  }

  let remaining = requestedAtomic;

  const fromWallet =
    remaining <= buckets.walletAtomic ? remaining : buckets.walletAtomic;
  remaining -= fromWallet;

  const fromVault = remaining <= buckets.vaultAtomic ? remaining : buckets.vaultAtomic;
  remaining -= fromVault;

  const fromVoi = remaining <= buckets.voiAtomic ? remaining : buckets.voiAtomic;
  remaining -= fromVoi;

  if (remaining > 0n) {
    throw new Error("Withdrawal amount exceeds your available balance.");
  }

  return { fromWallet, fromVault, fromVoi };
}

export function walletPlusVaultAtomic(buckets: WithdrawBalanceBuckets): bigint {
  return buckets.walletAtomic + buckets.vaultAtomic;
}
