export type DynamicChainName = "EVM" | "SOL" | "BTC" | "SUI";

export type DynamicExecutionState =
  | "initiated"
  | "source_attached"
  | "quoted"
  | "signing"
  | "broadcasted"
  | "failed"
  | "cancelled"
  | "expired";

export type DynamicSettlementState =
  | "none"
  | "routing"
  | "bridging"
  | "swapping"
  | "settling"
  | "completed"
  | "failed";

export type DynamicRiskState = "unknown" | "cleared" | "blocked";

export type DynamicFlowQuote = {
  version: number;
  fromAmount: string;
  toAmount: string;
  estimatedTimeSec?: number;
  fees?: {
    totalFeeUsd?: string;
    gasEstimate?: {
      usdValue?: string;
      nativeValue?: string;
      nativeSymbol?: string;
    };
  };
  createdAt?: string;
  expiresAt?: string;
  signingPayload?: DynamicSigningPayload;
};

export type DynamicEvmApproval = {
  tokenAddress: string;
  spenderAddress: string;
  amount: string;
};

export type DynamicEvmTransaction = {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
};

export type DynamicSigningPayload = {
  chainName: DynamicChainName;
  chainId: string;
  evmTransaction?: DynamicEvmTransaction;
  evmApproval?: DynamicEvmApproval;
  serializedTransaction?: string;
  psbt?: string;
};

export type DynamicCheckoutTransaction = {
  id: string;
  checkoutId: string;
  amount: string;
  currency: string;
  executionState: DynamicExecutionState;
  settlementState: DynamicSettlementState;
  riskState: DynamicRiskState;
  quoteVersion: number;
  quote?: DynamicFlowQuote;
  txHash?: string;
};

export type DynamicCreateTransactionResponse = {
  sessionToken: string;
  sessionExpiresAt: string;
  transaction: DynamicCheckoutTransaction;
};

export type DynamicFlowDepositSession = {
  transactionId: string;
  sessionToken: string;
  sessionExpiresAt: string;
  environmentId: string;
  amount: string;
  destinationAddress: `0x${string}`;
};
