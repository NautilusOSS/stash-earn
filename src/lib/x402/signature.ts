import { parseSignature, signatureToHex, type Hex } from "viem";

/** USDC EIP-3009 requires v=27|28; some signers return yParity 0|1 in the signature bytes. */
export function normalizeEoaSignature(signature: string): Hex {
  const hex = signature as Hex;
  const byteLen = hex.startsWith("0x") ? (hex.length - 2) / 2 : hex.length / 2;
  if (byteLen !== 65) return hex;

  const parsed = parseSignature(hex);
  const v =
    parsed.v != null
      ? parsed.v
      : parsed.yParity != null
        ? BigInt(parsed.yParity + 27)
        : undefined;
  if (v == null) return hex;

  return signatureToHex({ r: parsed.r, s: parsed.s, v });
}

/** v=27|28 for USDC transferWithAuthorization when splitting ECDSA signatures. */
export function eip3009ContractV(parsed: ReturnType<typeof parseSignature>): number {
  if (parsed.v != null) return Number(parsed.v);
  if (parsed.yParity != null) return parsed.yParity + 27;
  return 0;
}
