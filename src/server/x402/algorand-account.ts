import algosdk from "algosdk";

import { getX402Config } from "./config";

/** Strip inline `#` comments (common in .env mnemonic lines). */
export function normalizeAlgorandMnemonic(raw: string): string {
  const withoutComment = raw.split("#")[0]?.trim() ?? raw.trim();
  return withoutComment.replace(/\s+/g, " ").trim();
}

/** algosdk v3 uses Address objects — coerce to base32 string for APIs and server fn responses. */
export function formatAlgorandAddress(address: string | algosdk.Address): string {
  return typeof address === "string" ? address : address.toString();
}

/** Platform AVM account from ALGORAND_MNEMONIC only. */
export function loadAlgorandMnemonicAccount(): algosdk.Account | null {
  const raw = process.env.ALGORAND_MNEMONIC?.trim();
  if (!raw) return null;
  return algosdk.mnemonicToSecretKey(normalizeAlgorandMnemonic(raw));
}

/**
 * Loads an Algorand account from server env for settlement/accounting.
 * Prefers ALGORAND_MNEMONIC, then ALGORAND_PRIVATE_KEY.
 * SECURITY: Never expose this account or mnemonic to client code.
 */
export function loadAlgorandAccount(): algosdk.Account | null {
  const mnemonicAccount = loadAlgorandMnemonicAccount();
  if (mnemonicAccount) return mnemonicAccount;

  const { algorand } = getX402Config();

  if (algorand.privateKey) {
    const raw = algorand.privateKey.trim();
    const sk = raw.startsWith("0x")
      ? Uint8Array.from(Buffer.from(raw.slice(2), "hex"))
      : Uint8Array.from(Buffer.from(raw, "base64"));

    if (sk.length !== 64) {
      throw new Error("ALGORAND_PRIVATE_KEY must be 64 bytes (hex or base64).");
    }

    return {
      addr: algosdk.encodeAddress(sk.subarray(32)),
      sk,
    };
  }

  return null;
}

export function getAlgorandNodeConfig(): { algodServer?: string; indexerServer?: string } {
  const { algorand } = getX402Config();
  return {
    algodServer: algorand.nodeUrl,
    indexerServer: algorand.indexerUrl,
  };
}
