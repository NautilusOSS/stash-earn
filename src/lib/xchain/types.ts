import type { SignTypedDataParams } from "algo-x-evm-sdk/dist/utils.js";

import type { XCHAIN_PROTOCOL } from "@/lib/xchain/constants";

export type { SignTypedDataParams };

export type XChainDerivedAddresses = {
  evmAddress: `0x${string}`;
  voiAddress: string;
  voiExecutionAddress: string;
  logicVersion: typeof import("@/lib/xchain/constants").XCHAIN_CANONICAL_LOGIC_VERSION;
  voiExecutionLogicVersion: typeof import("@/lib/xchain/constants").VOI_EXECUTION_LOGIC_VERSION;
  protocol: typeof XCHAIN_PROTOCOL;
  isDeterministic: true;
};

export type XChainSelfPaymentPrepareResult = {
  unsignedTxnBase64: string;
  typedData: SignTypedDataParams;
  voiAddress: string;
  voiExecutionAddress: string;
  network: typeof import("@/lib/voi/constants").VOI_NETWORK;
};

export type XChainSelfPaymentSubmitResult = {
  txId: string;
  confirmedRound: number;
  voiAddress: string;
  voiExecutionAddress: string;
};
