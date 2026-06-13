import algosdk from "algosdk";

import { getX402Config } from "./config";

/**
 * Loads an Algorand account from server env for future settlement/accounting.
 * SECURITY: Never expose this account or mnemonic to client code.
 */
export function loadAlgorandAccount(): algosdk.Account | null {
  const { algorand } = getX402Config();

  if (algorand.mnemonic) {
    return algosdk.mnemonicToSecretKey(algorand.mnemonic);
  }

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
