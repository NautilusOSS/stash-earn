export const EVM_NATIVE_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export type DynamicEvmChain = {
  chainId: number;
  label: string;
  shortLabel: string;
};

export type DynamicEvmToken = {
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  isNative?: boolean;
};

export const DYNAMIC_EVM_CHAINS: DynamicEvmChain[] = [
  { chainId: 8453, label: "Base", shortLabel: "Base" },
  { chainId: 1, label: "Ethereum", shortLabel: "ETH" },
  { chainId: 42161, label: "Arbitrum", shortLabel: "ARB" },
  { chainId: 10, label: "Optimism", shortLabel: "OP" },
  { chainId: 137, label: "Polygon", shortLabel: "MATIC" },
];

const USDC_BY_CHAIN: Record<number, `0x${string}`> = {
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
  137: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
};

const USDT_BY_CHAIN: Record<number, `0x${string}`> = {
  8453: "0xfde4C96c8593536E31F229EA8f7b29Ed64F9Fc46",
  1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
};

export function getDynamicChain(chainId: number): DynamicEvmChain | undefined {
  return DYNAMIC_EVM_CHAINS.find((chain) => chain.chainId === chainId);
}

export function getTokensForChain(chainId: number): DynamicEvmToken[] {
  const tokens: DynamicEvmToken[] = [
    {
      symbol: "ETH",
      address: EVM_NATIVE_TOKEN_ADDRESS,
      decimals: 18,
      isNative: true,
    },
  ];

  const usdc = USDC_BY_CHAIN[chainId];
  if (usdc) {
    tokens.push({ symbol: "USDC", address: usdc, decimals: 6 });
  }

  const usdt = USDT_BY_CHAIN[chainId];
  if (usdt) {
    tokens.push({ symbol: "USDT", address: usdt, decimals: 6 });
  }

  return tokens;
}

export function chainIdToHex(chainId: number): `0x${string}` {
  return `0x${chainId.toString(16)}` as `0x${string}`;
}
