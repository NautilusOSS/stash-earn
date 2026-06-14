export type PayerWalletKind = "eoa" | "eip7702" | "contract";

/** EIP-7702 delegation designator prefix (Kernel / smart-account bytecode on the EOA). */
export function isEip7702DelegatedBytecode(code: string | undefined | null): boolean {
  return typeof code === "string" && code.toLowerCase().startsWith("0xef0100");
}

export function describePayerWalletKind(code: string | undefined | null): PayerWalletKind {
  if (!code || code === "0x") return "eoa";
  if (isEip7702DelegatedBytecode(code)) return "eip7702";
  return "contract";
}

/** EOAs and EIP-7702 Kernel delegated accounts can pay via USDC EIP-3009. */
export function isUsdcEip3009CompatibleWallet(code: string | undefined | null): boolean {
  const kind = describePayerWalletKind(code);
  return kind === "eoa" || kind === "eip7702";
}
