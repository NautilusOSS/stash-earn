import { getXChainExecutionStatusFn } from "@/lib/api/dorkfi.functions";

const DEFAULT_POLL_MS = 3_000;
const DEFAULT_TIMEOUT_MS = 120_000;

export async function waitForExecutionUsdcBalance(params: {
  evmAddress: string;
  minUsdc: number;
  pollMs?: number;
  timeoutMs?: number;
}): Promise<number> {
  const pollMs = params.pollMs ?? DEFAULT_POLL_MS;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const status = await getXChainExecutionStatusFn({
      data: { evmAddress: params.evmAddress },
    });
    if (status.usdcBalance >= params.minUsdc) {
      return status.usdcBalance;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(
    `Timed out waiting for USDC on your Voi execution address (need at least ${params.minUsdc.toFixed(2)} USDC).`,
  );
}
