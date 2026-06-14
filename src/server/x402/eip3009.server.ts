import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  hashTypedData,
  http,
  parseErc6492Signature,
  parseSignature,
  verifyTypedData,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

import {
  isKernelErc1271Signature,
  verifyErc1271Signature,
} from "@/lib/x402/kernel-sign";
import { eip3009ContractV, normalizeEoaSignature } from "@/lib/x402/signature";
import {
  describePayerWalletKind,
  type PayerWalletKind,
} from "@/lib/x402/wallet-kind";

import { requireEvmSettlementConfig } from "./config";

const authorizationTypes = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const eip3009Abi = [
  {
    type: "function",
    name: "transferWithAuthorization",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferWithAuthorization",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "authorizationState",
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

type EvmAuthorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
};

type Eip3009InnerPayload = {
  authorization: EvmAuthorization;
  signature: Hex;
};

function chainForId(chainId: number, rpcUrl: string) {
  if (chainId === base.id) return base;
  if (chainId === baseSepolia.id) return baseSepolia;
  return {
    ...base,
    id: chainId,
    rpcUrls: { default: { http: [rpcUrl] } },
  };
}

function chainIdFromNetwork(network: string): number {
  const match = network.match(/^eip155:(\d+)$/);
  if (!match) {
    throw new Error(`Unsupported network: ${network}`);
  }
  return Number(match[1]);
}

function extractEip3009Payload(payload: PaymentPayload): Eip3009InnerPayload | null {
  const inner = payload.payload as Record<string, unknown>;
  const auth = inner.authorization as EvmAuthorization | undefined;
  const signature = inner.signature;
  if (!auth?.from || typeof signature !== "string") return null;
  return { authorization: auth, signature: signature as Hex };
}

function buildTypedData(
  auth: EvmAuthorization,
  requirements: PaymentRequirements,
  chainId: number,
) {
  if (!requirements.extra?.name || !requirements.extra?.version) {
    throw new Error("Payment requirements missing USDC EIP-712 domain (name, version).");
  }

  return {
    types: authorizationTypes,
    primaryType: "TransferWithAuthorization" as const,
    domain: {
      name: requirements.extra.name as string,
      version: requirements.extra.version as string,
      chainId,
      verifyingContract: getAddress(requirements.asset),
    },
    message: {
      from: getAddress(auth.from),
      to: getAddress(auth.to),
      value: BigInt(auth.value),
      validAfter: BigInt(auth.validAfter),
      validBefore: BigInt(auth.validBefore),
      nonce: auth.nonce,
    },
  };
}

function transferArgs(auth: EvmAuthorization) {
  return [
    getAddress(auth.from),
    getAddress(auth.to),
    BigInt(auth.value),
    BigInt(auth.validAfter),
    BigInt(auth.validBefore),
    auth.nonce,
  ] as const;
}

function signatureArgs(signature: Hex): readonly [number, Hex, Hex] | readonly [Hex] {
  const { signature: innerSignature } = parseErc6492Signature(signature);
  const sigLength = innerSignature.startsWith("0x")
    ? innerSignature.length - 2
    : innerSignature.length;

  if (sigLength === 130) {
    const parsed = parseSignature(innerSignature);
    return [eip3009ContractV(parsed), parsed.r, parsed.s] as const;
  }

  return [innerSignature] as const;
}

export type LocalEip3009VerifyResult =
  | { isValid: true; payer: string }
  | {
      isValid: false;
      invalidReason: string;
      payer: string;
      simulationRevert?: string;
      payerWalletKind?: PayerWalletKind;
      signatureValid?: boolean;
    };

/** Verify EIP-3009 USDC payments locally (correct v=27|28 for simulation). */
export async function verifyEip3009Payment(
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<LocalEip3009VerifyResult> {
  const eip3009 = extractEip3009Payload(paymentPayload);
  if (!eip3009) {
    return { isValid: false, invalidReason: "invalid_payload", payer: "unknown" };
  }

  const payer = getAddress(eip3009.authorization.from);
  const normalizedSig = normalizeEoaSignature(eip3009.signature);
  const auth = eip3009.authorization;

  if (paymentPayload.accepted?.scheme !== "exact" || requirements.scheme !== "exact") {
    return { isValid: false, invalidReason: "invalid_scheme", payer };
  }

  if (getAddress(auth.to) !== getAddress(requirements.payTo)) {
    return { isValid: false, invalidReason: "recipient_mismatch", payer };
  }

  if (BigInt(auth.value) !== BigInt(requirements.amount)) {
    return { isValid: false, invalidReason: "authorization_value_too_low", payer };
  }

  const now = Math.floor(Date.now() / 1000);
  if (BigInt(auth.validBefore) < BigInt(now + 6)) {
    return { isValid: false, invalidReason: "authorization_valid_before_expired", payer };
  }
  if (BigInt(auth.validAfter) > BigInt(now)) {
    return { isValid: false, invalidReason: "authorization_valid_after_in_future", payer };
  }

  const evm = requireEvmSettlementConfig();
  const chainId = chainIdFromNetwork(requirements.network);
  const chain = chainForId(evm.chainId, evm.rpcUrl);
  const publicClient = createPublicClient({ chain, transport: http(evm.rpcUrl) });

  const payerCode = await publicClient.getCode({ address: payer });
  const payerWalletKind = describePayerWalletKind(payerCode);
  if (payerWalletKind === "contract") {
    return {
      isValid: false,
      invalidReason: "smart_contract_wallet",
      payer,
      payerWalletKind,
    };
  }

  const typedData = buildTypedData(auth, requirements, chainId);
  const digest = hashTypedData(typedData);

  const sigLen = normalizedSig.startsWith("0x") ? normalizedSig.length - 2 : normalizedSig.length;
  const useErc1271 = payerWalletKind === "eip7702" || isKernelErc1271Signature(normalizedSig);

  let signatureValid = false;
  if (useErc1271) {
    signatureValid = await verifyErc1271Signature(publicClient, payer, digest, normalizedSig);
  } else {
    try {
      signatureValid = await verifyTypedData({
        address: payer,
        ...typedData,
        signature: normalizedSig,
      });
    } catch {
      signatureValid = false;
    }
  }

  if (!signatureValid) {
    return {
      isValid: false,
      invalidReason:
        payerWalletKind === "eip7702" ? "eip7702_delegated_wallet" : "invalid_signature",
      payer,
      payerWalletKind,
      signatureValid,
    };
  }

  const relayer = privateKeyToAccount(evm.privateKey as Hex);

  const nonceUsed = await publicClient.readContract({
    address: requirements.asset as Address,
    abi: eip3009Abi,
    functionName: "authorizationState",
    args: [payer, auth.nonce],
  });
  if (nonceUsed) {
    return { isValid: false, invalidReason: "nonce_already_used", payer };
  }

  const balance = await publicClient.readContract({
    address: requirements.asset as Address,
    abi: eip3009Abi,
    functionName: "balanceOf",
    args: [payer],
  });
  if (balance < BigInt(requirements.amount)) {
    return { isValid: false, invalidReason: "insufficient_balance", payer };
  }

  try {
    await publicClient.simulateContract({
      account: relayer,
      address: requirements.asset as Address,
      abi: eip3009Abi,
      functionName: "transferWithAuthorization",
      args: [...transferArgs(auth), ...signatureArgs(normalizedSig)],
    });
  } catch (error) {
    const simulationRevert = error instanceof Error ? error.message.slice(0, 500) : String(error);
    console.error("[x402] local EIP-3009 simulation failed", {
      payer,
      sigLen,
      contractV: sigLen === 130 ? eip3009ContractV(parseSignature(normalizedSig)) : "bytes",
      signatureValid,
      payerWalletKind,
      simulationRevert,
    });
    return {
      isValid: false,
      invalidReason: "invalid_exact_evm_transaction_simulation_failed",
      payer,
      payerWalletKind,
      signatureValid,
      simulationRevert,
    };
  }

  return { isValid: true, payer };
}

export async function settleEip3009Payment(
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<{
  success: boolean;
  transaction?: Hex;
  payer?: string;
  error?: string;
}> {
  const verified = await verifyEip3009Payment(paymentPayload, requirements);
  if (!verified.isValid) {
    return {
      success: false,
      error: verified.simulationRevert ?? verified.invalidReason,
      payer: verified.payer,
    };
  }

  const eip3009 = extractEip3009Payload(paymentPayload)!;
  const normalizedSig = normalizeEoaSignature(eip3009.signature);
  const evm = requireEvmSettlementConfig();
  const chain = chainForId(evm.chainId, evm.rpcUrl);
  const relayer = privateKeyToAccount(evm.privateKey as Hex);
  const walletClient = createWalletClient({
    account: relayer,
    chain,
    transport: http(evm.rpcUrl),
  });

  try {
    const hash = await walletClient.writeContract({
      address: requirements.asset as Address,
      abi: eip3009Abi,
      functionName: "transferWithAuthorization",
      args: [...transferArgs(eip3009.authorization), ...signatureArgs(normalizedSig)],
    });

    const publicClient = createPublicClient({ chain, transport: http(evm.rpcUrl) });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      return { success: false, error: "Settlement transaction reverted", payer: verified.payer };
    }

    return { success: true, transaction: hash, payer: verified.payer };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Settlement failed",
      payer: verified.payer,
    };
  }
}
