import { ALGO_X_EVM_LSIG_TEAL } from "algo-x-evm-sdk/dist/generated/teal.js";

export const VOI_XCHAIN_EXECUTION_TEAL = ALGO_X_EVM_LSIG_TEAL.replace(
  "#pragma version 11",
  "#pragma version 10",
);

export const XCHAIN_CANONICAL_LOGIC_VERSION = 11;
export const VOI_EXECUTION_LOGIC_VERSION = 10;
export const XCHAIN_PROTOCOL = "xchain-accounts" as const;
