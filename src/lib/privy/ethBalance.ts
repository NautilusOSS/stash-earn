import { createPublicClient, formatUnits, http, type Address } from "viem";

import { CHAIN } from "./constants";

export async function fetchWalletEthBalance(walletAddress: Address): Promise<number> {
  const client = createPublicClient({
    chain: CHAIN,
    transport: http(),
  });

  const wei = await client.getBalance({ address: walletAddress });
  return Number(formatUnits(wei, 18));
}
