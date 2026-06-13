/** Blink deposit chain + token constants (see src/lib/blink/config.ts). */
import { USDC_ADDRESS } from "@/lib/privy/constants";

export {
  BLINK_CHAIN_CONFIG,
  getBlinkChainConfig,
  getBlinkEnvironmentClient,
  getBlinkMerchantIdClient,
  parseBlinkEnvironment,
  type BlinkEnvironment,
} from "@/lib/blink/config";

/** @deprecated Use getBlinkChainConfig(getBlinkEnvironmentClient()).chainId */
export const BLINK_BASE_CHAIN_ID = 8453;

/** @deprecated Use getBlinkChainConfig().usdc */
export const BLINK_USDC_TOKEN = USDC_ADDRESS;

/** @deprecated Use getBlinkChainConfig().payUrl */
export const BLINK_PAY_URL = "https://pay.blink.cash";
