export function getDynamicEnvironmentIdClient(): string {
  return import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID?.trim() ?? "";
}

export function getDynamicCheckoutIdClient(): string {
  return import.meta.env.VITE_DYNAMIC_CHECKOUT_ID?.trim() ?? "";
}
