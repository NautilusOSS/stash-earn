import { ensureAvmUsdcOptIn } from "@/lib/voi/avm-usdc-opt-in.server";
import { loadAlgorandMnemonicAccount } from "@/server/x402/algorand-account";

let startupPromise: Promise<void> | undefined;

/**
 * On server boot, opt the platform AVM account (ALGORAND_MNEMONIC) into Voi USDC (ASA 302190).
 */
export function schedulePlatformUsdcOptIn(): void {
  if (startupPromise) return;

  startupPromise = runPlatformUsdcOptIn().catch((error) => {
    console.error(
      "[platform] AVM USDC opt-in startup failed:",
      error instanceof Error ? error.message : error,
    );
  });
}

async function runPlatformUsdcOptIn(): Promise<void> {
  const platformAccount = loadAlgorandMnemonicAccount();
  if (!platformAccount) {
    console.info("[platform] Skipping AVM USDC opt-in — set ALGORAND_MNEMONIC");
    return;
  }

  await ensureAvmUsdcOptIn(platformAccount);
}
