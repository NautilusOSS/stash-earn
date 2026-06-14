import { toFacilitatorEvmSigner } from "@x402/evm";
import { registerExactEvmScheme } from "@x402/evm/exact/facilitator";
import { x402Facilitator } from "@x402/core/facilitator";
import { x402ResourceServer } from "@x402/core/server";
import { ExactEvmScheme as ExactEvmResourceScheme } from "@x402/evm/exact/server";
import {
  createPublicClient,
  createWalletClient,
  http,
  verifyTypedData,
  type Address,
  type Hex,
  type TypedData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

import { requireEvmSettlementConfig } from "./config";
import { settleEip3009Payment } from "./eip3009.server";
import type { SettleEvmResult } from "./types";

function chainForId(chainId: number, rpcUrl: string) {
  if (chainId === base.id) return base;
  if (chainId === baseSepolia.id) return baseSepolia;
  return {
    ...base,
    id: chainId,
    rpcUrls: { default: { http: [rpcUrl] } },
  };
}

let facilitatorInstance: x402Facilitator | undefined;
let resourceServerInstance: x402ResourceServer | undefined;

/**
 * Local x402 facilitator using server EVM_PRIVATE_KEY to verify and settle USDC payments.
 * SECURITY: Private key never leaves this server module.
 */
export function getLocalFacilitator(): x402Facilitator {
  if (facilitatorInstance) return facilitatorInstance;

  const evm = requireEvmSettlementConfig();
  const chain = chainForId(evm.chainId, evm.rpcUrl);
  const account = privateKeyToAccount(evm.privateKey as `0x${string}`);

  const publicClient = createPublicClient({ chain, transport: http(evm.rpcUrl) });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(evm.rpcUrl),
  });

  const combinedClient = {
    address: account.address,
    getAddresses: () => [account.address] as const,
    readContract: publicClient.readContract,
    getCode: publicClient.getCode,
    writeContract: walletClient.writeContract,
    sendTransaction: walletClient.sendTransaction,
    waitForTransactionReceipt: publicClient.waitForTransactionReceipt,
    verifyTypedData: async (args: {
      address: Address;
      signature: Hex;
      domain: TypedData["domain"];
      types: TypedData["types"];
      primaryType: string;
      message: Record<string, unknown>;
    }) =>
      verifyTypedData({
        address: args.address,
        signature: args.signature,
        domain: args.domain,
        types: args.types,
        primaryType: args.primaryType,
        message: args.message,
      }),
  };

  const signer = toFacilitatorEvmSigner(combinedClient);
  const facilitator = new x402Facilitator();

  registerExactEvmScheme(facilitator, {
    signer,
    networks: evm.network,
  });

  facilitatorInstance = facilitator;
  return facilitator;
}

export function getX402ResourceServer(): x402ResourceServer {
  if (resourceServerInstance) return resourceServerInstance;

  const evm = requireEvmSettlementConfig();
  const facilitator = getLocalFacilitator();

  resourceServerInstance = new x402ResourceServer(facilitator).register(
    evm.network,
    new ExactEvmResourceScheme(),
  );

  return resourceServerInstance;
}

export async function settleEvmPayment(
  paymentPayload: PaymentPayload,
  requirements: PaymentRequirements,
): Promise<SettleEvmResult> {
  const inner = paymentPayload.payload as Record<string, unknown>;
  if (inner.authorization) {
    const result = await settleEip3009Payment(paymentPayload, requirements);
    if (result.success && result.transaction) {
      return {
        success: true,
        settleResponse: {
          success: true,
          transaction: result.transaction,
          payer: result.payer,
          network: requirements.network,
        },
      };
    }
    return {
      success: false,
      error: result.error ?? "Settlement failed",
      settleResponse: {
        success: false,
        errorMessage: result.error,
        payer: result.payer,
        network: requirements.network,
        transaction: "",
      },
    };
  }

  try {
    const facilitator = getLocalFacilitator();
    const settleResponse = await facilitator.settle(paymentPayload, requirements);
    return { success: settleResponse.success, settleResponse };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Settlement failed",
    };
  }
}

export function getEvmReceiverAddress(): Address {
  return requireEvmSettlementConfig().receiverAddress;
}

export function getUsdcContractAddress(): Address {
  return requireEvmSettlementConfig().usdcContractAddress;
}

export function isEvmSettlementConfigured(): boolean {
  try {
    requireEvmSettlementConfig();
    return true;
  } catch {
    return false;
  }
}
