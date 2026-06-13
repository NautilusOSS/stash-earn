export const DORKFI_MARKET_DATA_API_BASE = "https://dorkfi-api.nautilus.sh/market-data";

/** Voi mainnet A-Market USDC lending market (Aramid USDC / aUSDC). */
export const VOI_MAINNET_A_MARKET_USDC = {
  chain: "voi-mainnet",
  dorkfiChain: "voi" as const,
  symbol: "aUSDC",
  poolId: 47139778,
  marketId: 395614,
  contractId: 395614,
  underlyingAssetId: 302190,
  nTokenId: 47140315,
  decimals: 6,
  label: "A-Market USDC",
  network: "Voi mainnet",
} as const;

/** Minimum spendable VOI on execution address before attempting a supply group. */
export const MIN_SPENDABLE_VOI_FOR_DORKFI_DEPOSIT = 0.1;
