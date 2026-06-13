import { getAddress, isAddress } from "viem";

export type EvmAddressValidation =
  | { valid: true; normalized: `0x${string}` }
  | { valid: false; error: string };

export function validateEvmAddress(address: string): EvmAddressValidation {
  const trimmed = address.trim();
  if (!trimmed) {
    return { valid: false, error: "EVM address is required" };
  }
  if (!isAddress(trimmed)) {
    return { valid: false, error: "Invalid EVM address format" };
  }
  return { valid: true, normalized: getAddress(trimmed) as `0x${string}` };
}
