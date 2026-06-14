import type { ConnectedWallet } from "@privy-io/react-auth";
import type { Address, Hex, TypedDataDefinition } from "viem";
import { createPublicClient, getAddress, http, serializeTypedData } from "viem";
import { base } from "viem/chains";

import type { X402EvmSigner } from "./client";
import {
  buildKernelWrapperTypedData,
  hashTransferWithAuthorization,
  isTransferWithAuthorizationRequest,
  readKernelDomainVersion,
  wrapSignatureWithKernelMode,
} from "./kernel-sign";
import { normalizeEoaSignature } from "./signature";
import { describePayerWalletKind, type PayerWalletKind } from "./wallet-kind";

const EIP712_DOMAIN_TYPES = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
] as const;

async function signTypedDataViaProvider(
  provider: Awaited<ReturnType<ConnectedWallet["getEthereumProvider"]>>,
  address: Address,
  input: {
    domain: TypedDataDefinition["domain"];
    types: TypedDataDefinition["types"];
    primaryType: string;
    message: Record<string, unknown>;
  },
): Promise<Hex> {
  const typedDataJson = serializeTypedData({
    domain: input.domain,
    types: {
      EIP712Domain: [...EIP712_DOMAIN_TYPES],
      ...input.types,
    },
    primaryType: input.primaryType,
    message: input.message,
  });
  const typedData = JSON.parse(typedDataJson) as {
    domain: TypedDataDefinition["domain"];
    types: TypedDataDefinition["types"];
    primaryType: string;
    message: Record<string, unknown>;
  };

  return (await provider.request({
    method: "eth_signTypedData_v4",
    params: [address, typedData],
  })) as Hex;
}

/**
 * Privy embedded wallet signer.
 * EIP-7702 Kernel accounts sign USDC EIP-3009 via Kernel wrapper + ERC-1271 bytes.
 */
export async function createPrivyX402Signer(wallet: ConnectedWallet): Promise<X402EvmSigner> {
  const address = getAddress(wallet.address) as Address;
  const provider = await wallet.getEthereumProvider();
  const publicClient = createPublicClient({ chain: base, transport: http() });

  let walletKind: PayerWalletKind | null = null;
  let kernelVersion: string | null = null;

  async function ensureWalletKind(): Promise<PayerWalletKind> {
    if (walletKind) return walletKind;
    const code = await publicClient.getCode({ address });
    walletKind = describePayerWalletKind(code);
    if (walletKind === "eip7702") {
      kernelVersion = await readKernelDomainVersion(publicClient, address);
    }
    return walletKind;
  }

  return {
    address,
    signTypedData: async (input) => {
      const kind = await ensureWalletKind();

      if (
        kind === "eip7702" &&
        isTransferWithAuthorizationRequest(input)
      ) {
        const chainId = Number(input.domain?.chainId ?? base.id);
        const usdcDigest = hashTransferWithAuthorization({
          domain: input.domain,
          message: input.message,
        });
        const kernelTypedData = buildKernelWrapperTypedData({
          usdcDigest,
          payer: address,
          chainId,
          kernelVersion: kernelVersion ?? "0.3.3",
        });

        const kernelSignature = await signTypedDataViaProvider(provider, address, {
          domain: kernelTypedData.domain,
          types: {
            EIP712Domain: [...EIP712_DOMAIN_TYPES],
            ...kernelTypedData.types,
          },
          primaryType: kernelTypedData.primaryType,
          message: kernelTypedData.message,
        });

        return wrapSignatureWithKernelMode(normalizeEoaSignature(kernelSignature));
      }

      const signature = await signTypedDataViaProvider(provider, address, input);
      return normalizeEoaSignature(signature);
    },
  };
}
