import { useEffect, useState, type ReactNode } from "react";

/** Renders children only after mount — skips SSR for browser-only widgets. */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return children;
}
