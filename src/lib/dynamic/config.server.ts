import { readEnv } from "@/lib/env.server";

export type DynamicServerConfig = {
  environmentId: string | undefined;
  checkoutId: string | undefined;
  apiToken: string | undefined;
};

export function getDynamicServerConfig(): DynamicServerConfig {
  return {
    environmentId: readEnv("DYNAMIC_ENVIRONMENT_ID") ?? readEnv("VITE_DYNAMIC_ENVIRONMENT_ID"),
    checkoutId: readEnv("DYNAMIC_CHECKOUT_ID") ?? readEnv("VITE_DYNAMIC_CHECKOUT_ID"),
    apiToken: readEnv("DYNAMIC_API_TOKEN"),
  };
}

export function isDynamicFlowConfiguredServer(): boolean {
  const config = getDynamicServerConfig();
  return Boolean(config.environmentId && config.checkoutId);
}

export function getDynamicConfigStatus(): {
  configured: boolean;
  environmentId: string | null;
  hasCheckoutId: boolean;
  hasApiToken: boolean;
} {
  const config = getDynamicServerConfig();
  const environmentId = config.environmentId ?? null;
  const hasCheckoutId = Boolean(config.checkoutId);
  const hasApiToken = Boolean(config.apiToken);

  return {
    configured: Boolean(environmentId && hasCheckoutId),
    environmentId,
    hasCheckoutId,
    hasApiToken,
  };
}
