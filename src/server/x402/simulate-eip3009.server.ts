import {
  createPublicClient,
  http,
  parseErc6492Signature,
  parseSignature,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

import { eip3009ContractV } from "@/lib/x402/signature";

import { requireEvmSettlementConfig } from "./config";

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
] as const;

type EvmAuthorization = {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
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

/** Re-run transferWithAuthorization via EVM_RPC_URL and return the revert reason, if any. */
export async function probeEip3009SimulationRevert(
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<string | null> {
  try {
    const evm = requireEvmSettlementConfig();
    const inner = paymentPayload.payload as Record<string, unknown>;
    const auth = inner.authorization as EvmAuthorization | undefined;
    const signature = inner.signature as Hex | undefined;
    if (!auth?.from || !signature) return null;

    const account = privateKeyToAccount(evm.privateKey as Hex);
    const client = createPublicClient({
      chain: chainForId(evm.chainId, evm.rpcUrl),
      transport: http(evm.rpcUrl),
    });

    const { signature: innerSignature } = parseErc6492Signature(signature);
    const sigLength = innerSignature.startsWith("0x")
      ? innerSignature.length - 2
      : innerSignature.length;
    const baseArgs = [
      auth.from as Address,
      auth.to as Address,
      BigInt(auth.value),
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce,
    ] as const;

    if (sigLength === 130) {
      const parsedSig = parseSignature(innerSignature);
      await client.simulateContract({
        account,
        address: requirements.asset as Address,
        abi: eip3009Abi,
        functionName: "transferWithAuthorization",
        args: [...baseArgs, eip3009ContractV(parsedSig), parsedSig.r, parsedSig.s],
      });
    } else {
      await client.simulateContract({
        account,
        address: requirements.asset as Address,
        abi: eip3009Abi,
        functionName: "transferWithAuthorization",
        args: [...baseArgs, innerSignature],
      });
    }

    return null;
  } catch (error) {
    if (error instanceof Error) {
      return error.message.slice(0, 500);
    }
    return String(error).slice(0, 500);
  }
}
