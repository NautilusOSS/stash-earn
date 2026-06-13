import process from "node:process";

export function normalizeEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function readEnv(name: string): string | undefined {
  const fromProcess = normalizeEnvValue(process.env[name]);
  if (fromProcess) return fromProcess;

  if (name.startsWith("VITE_")) {
    const viteEnv = import.meta.env as Record<string, string | undefined>;
    return normalizeEnvValue(viteEnv[name]);
  }

  return undefined;
}
