/** Server-side mirror of VITE_DEBUG — safe to read from process.env at runtime. */
export function isServerDebugMode(): boolean {
  return process.env.VITE_DEBUG === "true";
}
