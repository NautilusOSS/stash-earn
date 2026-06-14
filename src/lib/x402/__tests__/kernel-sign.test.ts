import { describe, expect, it } from "vitest";
import { hashTypedData, signatureToHex } from "viem";

import {
  buildKernelWrapperTypedData,
  isKernelErc1271Signature,
  isTransferWithAuthorizationRequest,
  wrapSignatureWithKernelMode,
} from "../kernel-sign";

describe("kernel-sign", () => {
  it("detects TransferWithAuthorization typed data", () => {
    expect(
      isTransferWithAuthorizationRequest({
        primaryType: "TransferWithAuthorization",
        types: {
          TransferWithAuthorization: [{ name: "from", type: "address" }],
        },
      }),
    ).toBe(true);
    expect(
      isTransferWithAuthorizationRequest({
        primaryType: "Permit",
        types: { Permit: [] },
      }),
    ).toBe(false);
  });

  it("wraps ECDSA signatures with Kernel sudo mode byte", () => {
    const ecdsa = signatureToHex({
      r: "0x1111111111111111111111111111111111111111111111111111111111111111",
      s: "0x2222222222222222222222222222222222222222222222222222222222222222",
      v: 27n,
    });
    const wrapped = wrapSignatureWithKernelMode(ecdsa);
    expect(wrapped).toBe(`0x00${ecdsa.slice(2)}`);
    expect(isKernelErc1271Signature(wrapped)).toBe(true);
    expect(isKernelErc1271Signature(ecdsa)).toBe(false);
  });

  it("builds Kernel wrapper typed data for a USDC digest", () => {
    const payer = "0x942950b47a2853CBD929b3cFc0d129fbfA75233B";
    const usdcDigest = hashTypedData({
      domain: {
        name: "USD Coin",
        version: "2",
        chainId: 8453,
        verifyingContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      },
      types: {
        TransferWithAuthorization: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "validAfter", type: "uint256" },
          { name: "validBefore", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      primaryType: "TransferWithAuthorization",
      message: {
        from: payer,
        to: "0x72892DcC2218FF95899ee8Cd7dF3982Ce4055ED2",
        value: 10_000n,
        validAfter: 0n,
        validBefore: 9999999999n,
        nonce: "0xabcdef0000000000000000000000000000000000000000000000000000000000",
      },
    });

    const wrapper = buildKernelWrapperTypedData({
      usdcDigest,
      payer,
      chainId: 8453,
      kernelVersion: "0.3.3",
    });

    expect(wrapper.primaryType).toBe("Kernel");
    expect(wrapper.domain.name).toBe("Kernel");
    expect(wrapper.message.hash).toBe(usdcDigest);

    const wrappedDigest = hashTypedData(wrapper);
    expect(wrappedDigest).toMatch(/^0x[a-f0-9]{64}$/i);
  });
});
