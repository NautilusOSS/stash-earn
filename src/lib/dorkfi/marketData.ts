import { DORKFI_MARKET_DATA_API_BASE } from "./constants";

export interface DorkFiMarketData {
  reserveFactor: string;
  borrowRate: string;
  slope: string;
  totalScaledDeposits: string;
  totalScaledBorrows: string;
  depositIndex: string;
  borrowIndex: string;
  reserves: string;
}

interface DorkFiMarketDataResponse {
  success: boolean;
  data?: DorkFiMarketData;
  error?: string;
}

export async function fetchDorkFiMarketData(
  chain: string,
  poolId: number,
  marketId: number,
): Promise<DorkFiMarketData> {
  const url = `${DORKFI_MARKET_DATA_API_BASE}/${chain}/${poolId}/${marketId}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`DorkFi market data request failed (${response.status})`);
  }

  const json = (await response.json()) as DorkFiMarketDataResponse;

  if (!json.success || !json.data) {
    throw new Error(json.error ?? "DorkFi market data response was not successful");
  }

  return json.data;
}
