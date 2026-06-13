export const VOI_NETWORK = "mainnet" as const;

export const VOI_ALGOD_DEFAULT = {
  server: "https://mainnet-api.voi.nodely.dev",
  port: 443,
  token: "",
} as const;

export const VOI_INDEXER_DEFAULT = {
  server: "https://mainnet-idx.voi.nodely.dev",
  port: 443,
  token: "",
} as const;

export const VOI_BLOCK_EXPLORER_TX = "https://block.voi.network/explorer/transaction";

/** Voi mainnet USDC ASA */
export const VOI_USDC_ASSET_ID = 302190;

/** 1 VOI = 1_000_000 microAlgos */
export const VOI_MICROALGO = 1_000_000;
