import { useCallback, useEffect, useState } from "react";

import {
  appendActivity,
  loadActivity,
  type NewTransaction,
  type Transaction,
} from "@/lib/stash/activity";
import { validateEvmAddress } from "@/lib/xchain/validate";

export function useActivity(walletAddress: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const validation = walletAddress ? validateEvmAddress(walletAddress) : null;
  const normalizedAddress = validation?.valid ? validation.normalized : null;

  const refresh = useCallback(() => {
    if (!normalizedAddress) {
      setTransactions([]);
      return;
    }
    setTransactions(loadActivity(normalizedAddress));
  }, [normalizedAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ walletAddress?: string }>).detail;
      if (
        !normalizedAddress ||
        detail?.walletAddress?.toLowerCase() === normalizedAddress.toLowerCase()
      ) {
        refresh();
      }
    };

    window.addEventListener("cash-stash-activity-updated", handler);
    return () => window.removeEventListener("cash-stash-activity-updated", handler);
  }, [normalizedAddress, refresh]);

  const record = useCallback(
    (input: NewTransaction) => {
      if (!normalizedAddress) return null;
      const tx = appendActivity(normalizedAddress, input);
      setTransactions(loadActivity(normalizedAddress));
      return tx;
    },
    [normalizedAddress],
  );

  return {
    transactions,
    record,
    refresh,
    hasWallet: Boolean(normalizedAddress),
  };
}
