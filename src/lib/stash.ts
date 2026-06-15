import { create } from "zustand";

/** Fallback APY when live composite yield is unavailable. */
interface StashState {
  apy: number;
}

export const useStash = create<StashState>(() => ({
  apy: 0.0487,
}));

export { fmtUSD, friendlyDate } from "@/lib/stash/activity";
export type { Transaction, TxType } from "@/lib/stash/activity";
