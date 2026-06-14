import type { PublicClient } from "viem";
import {
  concat,
  hashTypedData,
  toHex,
  type Address,
  type Hex,
  type TypedDataDefinition,
} from "viem";

/** Kernel sudo/root validation mode (default for EIP-7702 delegated accounts). */
export const KERNEL_SUDO_MODE = 0x00;

/** ERC-1271 magic value returned by isValidSignature on success. */
export const ERC1271_MAGIC = "0x1626ba7e" as const;

export const KERNEL_WRAPPER_TYPES = {
  Kernel: [{ name: "hash", type: "bytes32" }],
} as const;

export const USDC_TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const eip712DomainAbi = [
  {
    type: "function",
    name: "eip712Domain",
    inputs: [],
    outputs: [
      { name: "fields", type: "bytes1" },
      { name: "name", type: "string" },
      { name: "version", type: "string" },
      { name: "chainId", type: "uint256" },
      { name: "verifyingContract", type: "address" },
      { name: "salt", type: "bytes32" },
      { name: "extensions", type: "uint256[]" },
    ],
    stateMutability: "view",
  },
] as const;

const erc1271Abi = [
  {
    type: "function",
    name: "isValidSignature",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "magicValue", type: "bytes4" }],
    stateMutability: "view",
  },
] as const;

export function isTransferWithAuthorizationRequest(input: {
  primaryType: string;
  types: TypedDataDefinition["types"];
}): boolean {
  return (
    input.primaryType === "TransferWithAuthorization" &&
    Boolean(input.types?.TransferWithAuthorization)
  );
}

/** Kernel ERC-1271 signatures prepend a mode byte to the 65-byte ECDSA payload. */
export function isKernelErc1271Signature(signature: Hex): boolean {
  const byteLen = signature.startsWith("0x") ? (signature.length - 2) / 2 : signature.length / 2;
  return byteLen > 65;
}

export function hashTransferWithAuthorization(input: {
  domain: TypedDataDefinition["domain"];
  message: Record<string, unknown>;
}): Hex {
  return hashTypedData({
    domain: input.domain,
    types: USDC_TRANSFER_WITH_AUTHORIZATION_TYPES,
    primaryType: "TransferWithAuthorization",
    message: input.message,
  });
}

export function buildKernelWrapperTypedData(input: {
  usdcDigest: Hex;
  payer: Address;
  chainId: number;
  kernelVersion: string;
}) {
  return {
    domain: {
      name: "Kernel",
      version: input.kernelVersion,
      chainId: input.chainId,
      verifyingContract: input.payer,
    },
    types: KERNEL_WRAPPER_TYPES,
    primaryType: "Kernel" as const,
    message: { hash: input.usdcDigest },
  };
}

export function wrapSignatureWithKernelMode(
  signature: Hex,
  mode: number = KERNEL_SUDO_MODE,
): Hex {
  return concat([toHex(mode, { size: 1 }), signature]);
}

/** Read Kernel EIP-712 version from ERC-5267 eip712Domain() on the delegated account. */
export async function readKernelDomainVersion(
  publicClient: PublicClient,
  account: Address,
): Promise<string> {
  try {
    const [, , version] = await publicClient.readContract({
      address: account,
      abi: eip712DomainAbi,
      functionName: "eip712Domain",
    });
    return version;
  } catch {
    return "0.3.3";
  }
}

export async function verifyErc1271Signature(
  publicClient: PublicClient,
  account: Address,
  digest: Hex,
  signature: Hex,
): Promise<boolean> {
  try {
    const magic = await publicClient.readContract({
      address: account,
      abi: erc1271Abi,
      functionName: "isValidSignature",
      args: [digest, signature],
    });
    return magic === ERC1271_MAGIC;
  } catch {
    return false;
  }
}
