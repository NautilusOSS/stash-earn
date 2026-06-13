import { normalizeEnvValue, readEnv } from "@/lib/env.server";
import {
  type BlinkEnvironment,
  getBlinkChainConfig,
  parseBlinkEnvironment,
} from "@/lib/blink/config";

export type BlinkServerConfig = {
  environment: BlinkEnvironment;
  merchantId: string | undefined;
  merchantPrivateKey: string | undefined;
  chainId: number;
  usdc: string;
  payUrl: string;
};

const PEM_PRIVATE_KEY_RE = /-----BEGIN (?:EC )?PRIVATE KEY-----/;

/** Decode PEM stored in .env as a single line with literal `\n` sequences. */
export function normalizeBlinkPrivateKey(value: string | undefined): string | undefined {
  const normalized = normalizeEnvValue(value);
  if (!normalized) return undefined;

  const withNewlines = normalized.replace(/\\n/g, "\n").trim();
  if (!PEM_PRIVATE_KEY_RE.test(withNewlines)) {
    return undefined;
  }

  return withNewlines;
}

function blinkEnv(name: string): string | undefined {
  return readEnv(name);
}

export function getBlinkServerConfig(): BlinkServerConfig {
  const environment = parseBlinkEnvironment(
    blinkEnv("BLINK_ENVIRONMENT") ?? blinkEnv("VITE_BLINK_ENVIRONMENT"),
  );
  const chain = getBlinkChainConfig(environment);

  return {
    environment,
    merchantId: blinkEnv("BLINK_MERCHANT_ID") ?? blinkEnv("VITE_BLINK_MERCHANT_ID"),
    merchantPrivateKey: normalizeBlinkPrivateKey(blinkEnv("BLINK_MERCHANT_PRIVATE_KEY")),
    chainId: chain.chainId,
    usdc: chain.usdc,
    payUrl: chain.payUrl,
  };
}

export function isBlinkConfiguredServer(): boolean {
  const config = getBlinkServerConfig();
  return Boolean(config.merchantId && config.merchantPrivateKey);
}

export function getBlinkConfigStatus(): {
  configured: boolean;
  environment: BlinkEnvironment;
  chainId: number;
  chainLabel: string;
  hasMerchantId: boolean;
  hasPrivateKey: boolean;
} {
  const config = getBlinkServerConfig();
  const hasMerchantId = Boolean(config.merchantId);
  const hasPrivateKey = Boolean(config.merchantPrivateKey);

  return {
    configured: hasMerchantId && hasPrivateKey,
    environment: config.environment,
    chainId: config.chainId,
    chainLabel: getBlinkChainConfig(config.environment).label,
    hasMerchantId,
    hasPrivateKey,
  };
}
