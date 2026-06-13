import { createPublicClient, erc20Abi, formatUnits, http, type Address } from "viem";

import { CHAIN, USDC_ADDRESS, USDC_DECIMALS } from "./constants";

export async function fetchWalletUsdcBalance(walletAddress: Address): Promise<number> {
  const client = createPublicClient({
    chain: CHAIN,
    transport: http(),
  });

  const raw = await client.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [walletAddress],
  });

  return Number(formatUnits(raw, USDC_DECIMALS));
}
