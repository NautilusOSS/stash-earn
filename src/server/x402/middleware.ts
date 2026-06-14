import type { MiddlewareHandler } from "hono";
import { encodePaymentResponseHeader } from "@x402/core/http";

import { getX402Config, MisconfiguredServerError } from "./config";
import { distributeVoiUsdcToPayer } from "./distribute-voi-usdc.server";
import { jsonError, paymentRequired, X402_ERRORS } from "./errors";
import { buildProtectedRequirements } from "./quote";
import { getReplayStore } from "./replay-store";
import { settleEvmPayment } from "./settle-evm";
import type { PaymentRequirement } from "./types";
import { derivePaymentId, extractPaymentHeader, verifyPaymentPayload } from "./verify";

type ProtectedRouteOptions = {
  path: string;
  description: string;
};

function verificationStatusToResponse(
  status: string,
  message: string,
): { status: 400 | 402 | 409; error: string } {
  switch (status) {
    case "missing":
      return { status: 402, error: X402_ERRORS.paymentRequired };
    case "underpaid":
      return { status: 402, error: X402_ERRORS.underpaid };
    case "replay":
      return { status: 409, error: X402_ERRORS.replay };
    case "invalid_payload":
      return { status: 400, error: X402_ERRORS.invalidPayload };
    case "verify_failed":
    case "wrong_network":
    case "wrong_recipient":
    case "wrong_token":
    case "expired":
      return { status: 402, error: X402_ERRORS.paymentVerificationFailed };
    default:
      return { status: 402, error: message || X402_ERRORS.paymentVerificationFailed };
  }
}

/**
 * Payment gate middleware.
 *
 * SECURITY BOUNDARY:
 * - Browser/wallet signs payment authorization (EIP-3009 / Permit2).
 * - Server verifies signature + requirements, settles on-chain, returns resource.
 * - Server private keys never reach the client.
 */
export function createPaymentGate(options: ProtectedRouteOptions): MiddlewareHandler {
  return async (c, next) => {
    try {
      const url = new URL(c.req.url);
      const amount = url.searchParams.get("amount") ?? getX402Config().x402.defaultUsdcAmount;

      const { paymentRequired: paymentRequiredPayload, requirement } =
        await buildProtectedRequirements(url.toString(), amount, options.description);

      const paymentHeader = extractPaymentHeader(c.req.raw.headers);
      const verification = await verifyPaymentPayload(paymentHeader, requirement as never, {
        resourceUrl: url.toString(),
      });

      if (verification.status !== "valid") {
        const mapped = verificationStatusToResponse(verification.status, verification.message);
        if (mapped.status === 402 && verification.status === "missing") {
          return paymentRequired(c, paymentRequiredPayload);
        }
        return jsonError(c, mapped.status, mapped.error, {
          message: verification.message,
          ...(verification.verifyResponse?.invalidReason
            ? { invalidReason: verification.verifyResponse.invalidReason }
            : {}),
          ...(verification.verifyResponse?.simulationRevert
            ? { simulationRevert: verification.verifyResponse.simulationRevert }
            : {}),
        });
      }

      const paymentId = derivePaymentId(verification.paymentPayload!);
      const replayStore = getReplayStore(getX402Config().x402.replayStorePath);

      if (await replayStore.has(paymentId)) {
        return jsonError(c, 409, X402_ERRORS.replay, { paymentId });
      }

      const settleResult = await settleEvmPayment(
        verification.paymentPayload!,
        verification.requirements!,
      );

      if (!settleResult.success || !settleResult.settleResponse?.success) {
        return jsonError(c, 402, X402_ERRORS.underpaid, {
          message: settleResult.error ?? settleResult.settleResponse?.errorMessage,
        });
      }

      const payerEvm =
        settleResult.settleResponse.payer ?? verification.payer ?? undefined;

      const voiDistribution =
        payerEvm != null
          ? await distributeVoiUsdcToPayer({
              payerEvmAddress: payerEvm,
              amountAtomic: requirement.amount,
            })
          : { attempted: false, skippedReason: "No payer EVM address on settlement" };

      await replayStore.record({
        paymentId,
        resourceId: options.path,
        payer: settleResult.settleResponse.payer ?? verification.payer ?? "unknown",
        payTo: requirement.payTo,
        amount: requirement.amount,
        asset: requirement.asset,
        network: requirement.network,
        transaction: settleResult.settleResponse.transaction,
        settledAt: new Date().toISOString(),
        voiUsdcRecipient: voiDistribution.recipientAddress,
        voiUsdcTransfer: voiDistribution.txId,
        voiUsdcTransferError: voiDistribution.error ?? voiDistribution.skippedReason,
      });

      if (voiDistribution.txId) {
        c.header("voi-usdc-transfer", voiDistribution.txId);
      }
      c.set("voiUsdcDistribution", voiDistribution);

      c.header("payment-response", encodePaymentResponseHeader(settleResult.settleResponse));
      await next();
    } catch (error) {
      if (error instanceof MisconfiguredServerError) {
        return jsonError(c, 500, X402_ERRORS.misconfigured, { message: error.message });
      }
      console.error("[x402] payment gate", error);
      return jsonError(c, 500, "Server error", {
        message: error instanceof Error ? error.message : "Payment processing failed",
      });
    }
  };
}

export async function buildRequirementFromHeader(
  resourceUrl: string,
  amount: string,
  description: string,
): Promise<PaymentRequirement> {
  const { requirement } = await buildProtectedRequirements(resourceUrl, amount, description);
  return requirement;
}
