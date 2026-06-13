import type { SignTypedDataParams } from "@/lib/xchain/types";

/** Privy requires mutable copies of EIP-712 type arrays. */
export function toPrivyTypedData(typedData: SignTypedDataParams) {
  return {
    domain: typedData.domain,
    types: {
      EIP712Domain: [...typedData.types.EIP712Domain],
      "Algorand Transaction": [...typedData.types["Algorand Transaction"]],
    },
    primaryType: typedData.primaryType,
    message: typedData.message,
  };
}
