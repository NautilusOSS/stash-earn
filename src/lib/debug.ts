export function isDebugMode(): boolean {
  return import.meta.env.VITE_DEBUG === "true";
}
