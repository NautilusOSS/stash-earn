import { beforeEach, describe, expect, it } from "vitest";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

import { MemoryReplayStore } from "../replay-store";
import {
  decodePaymentPayload,
  derivePaymentId,
  extractPaymentHeader,
  extractPayloadNetwork,
  validateRequirementsBinding,
  verifyPaymentPayload,
} from "../verify";

const RECEIVER = "0x1111111111111111111111111111111111111111";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NETWORK = "eip155:84532";
const PAYER = "0x2222222222222222222222222222222222222222";

function baseRequirements(overrides?: Partial<PaymentRequirements>): PaymentRequirements {
  return {
    scheme: "exact",
    network: NETWORK,
    amount: "10000",
    asset: USDC,
    payTo: RECEIVER,
    maxTimeoutSeconds: 300,
    ...overrides,
  };
}

function samplePayload(overrides?: Partial<PaymentPayload>): PaymentPayload {
  return {
    x402Version: 2,
    accepted: baseRequirements(),
    payload: {
      authorization: {
        from: PAYER,
        to: RECEIVER,
        value: "10000",
        validAfter: "0",
        validBefore: String(Math.floor(Date.now() / 1000) + 3600),
        nonce: "0xabcdef",
      },
    },
    ...overrides,
  };
}

describe("x402 verify", () => {
  beforeEach(() => {
    process.env.EVM_PRIVATE_KEY =
      "0xac0974bec39a17e36ba4a16b6b39d2a6c4b2ef55bbaa1636cfe2c9369fd470";
    process.env.EVM_RECEIVER_ADDRESS = RECEIVER;
    process.env.EVM_RPC_URL = "http://127.0.0.1:8545";
    process.env.EVM_CHAIN_ID = "84532";
    process.env.USDC_CONTRACT_ADDRESS = USDC;
  });

  it("reports missing payment header", async () => {
    const result = await verifyPaymentPayload(undefined, baseRequirements());
    expect(result.status).toBe("missing");
  });

  it("rejects invalid payment payload encoding", () => {
    expect(() => decodePaymentPayload("not-valid-base64!!!")).toThrow();
  });

  it("detects wrong recipient in requirements binding", () => {
    const result = validateRequirementsBinding(baseRequirements({ payTo: "0xbad000000000000000000000000000000000bad" }), {
      payTo: RECEIVER,
      asset: USDC,
      network: NETWORK,
    });
    expect(result?.status).toBe("wrong_recipient");
  });

  it("detects wrong token in requirements binding", () => {
    const result = validateRequirementsBinding(
      baseRequirements({ asset: "0xbad000000000000000000000000000000000bad" }),
      { payTo: RECEIVER, asset: USDC, network: NETWORK },
    );
    expect(result?.status).toBe("wrong_token");
  });

  it("detects wrong network in requirements binding", () => {
    const result = validateRequirementsBinding(baseRequirements({ network: "eip155:1" }), {
      payTo: RECEIVER,
      asset: USDC,
      network: NETWORK,
    });
    expect(result?.status).toBe("wrong_network");
  });

  it("detects underpaid authorization before facilitator verify", async () => {
    const { encodePaymentSignatureHeader } = await import("@x402/core/http");
    const payload = samplePayload();
    (payload.payload as { authorization: { value: string } }).authorization.value = "1";
    const header = encodePaymentSignatureHeader(payload);

    const result = await verifyPaymentPayload(header, baseRequirements());
    expect(result.status).toBe("underpaid");
  });

  it("reads network from v2 accepted field", () => {
    const payload = samplePayload();
    expect(extractPayloadNetwork(payload)).toBe(NETWORK);
  });

  it("detects v2 payload network mismatch", async () => {
    const { encodePaymentSignatureHeader } = await import("@x402/core/http");
    const payload = samplePayload({
      accepted: baseRequirements({ network: "eip155:1" }),
    });
    const header = encodePaymentSignatureHeader(payload);

    const result = await verifyPaymentPayload(header, baseRequirements());
    expect(result.status).toBe("wrong_network");
    expect(result.message).toContain("eip155:1");
  });

  it("derives stable payment ids for replay protection", () => {
    const payload = samplePayload();
    const id = derivePaymentId(payload);
    expect(id).toContain(PAYER.toLowerCase());
    expect(id).toContain("0xabcdef");
    expect(id).toContain(NETWORK);
  });

  it("tracks replay in memory store", async () => {
    const store = new MemoryReplayStore();
    const paymentId = "evm:test:nonce";
    expect(await store.has(paymentId)).toBe(false);
    await store.record({
      paymentId,
      payer: PAYER,
      payTo: RECEIVER,
      amount: "10000",
      asset: USDC,
      network: NETWORK,
      transaction: "0xtx",
      settledAt: new Date().toISOString(),
    });
    expect(await store.has(paymentId)).toBe(true);
  });

  it("reads payment headers from request", () => {
    const headers = new Headers({ "payment-signature": "abc" });
    expect(extractPaymentHeader(headers)).toBe("abc");
  });
});
