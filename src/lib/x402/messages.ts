export function parseX402DollarAmount(amount: string): number {
  const trimmed = amount.trim();
  if (trimmed.startsWith("$")) {
    const n = Number(trimmed.slice(1));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export type X402ErrorDetails = {
  message: string;
  invalidReason?: string;
};

/** Map on-chain revert text to actionable copy (simulation probe). */
export function formatX402SimulationRevert(simulationRevert?: string | null): string | undefined {
  if (!simulationRevert) return undefined;

  if (/invalid signature/i.test(simulationRevert)) {
    return undefined;
  }
  if (/insufficient.*balance|transfer.*exceeds.*balance/i.test(simulationRevert)) {
    return "Insufficient USDC in your embedded wallet on Base. x402 cannot spend USDC in the Earn vault.";
  }
  if (/authorization.*used|nonce.*used/i.test(simulationRevert)) {
    return "This payment nonce was already used on-chain. Run the smoke test again to sign a fresh authorization.";
  }

  return undefined;
}

/** Map facilitator invalidReason codes to actionable copy for debug UI. */
export function formatX402VerifyFailure(
  invalidReason?: string | null,
  options?: { clientUsdcReady?: boolean },
): string | undefined {
  if (!invalidReason) return undefined;

  if (invalidReason.includes("insufficient_balance")) {
    return "Server sees insufficient USDC in your embedded wallet via EVM_RPC_URL. Compare client vs server wallet USDC in preflight.";
  }
  if (invalidReason.includes("nonce_already_used")) {
    return "This payment nonce was already used on-chain. Run the smoke test again to sign a fresh authorization.";
  }
  if (invalidReason.includes("token_name_mismatch") || invalidReason.includes("token_version_mismatch")) {
    return "USDC EIP-712 domain mismatch on the server RPC. Check USDC_CONTRACT_ADDRESS and EVM_RPC_URL for Base mainnet.";
  }
  if (invalidReason.includes("eip7702_delegated_wallet")) {
    return (
      "Kernel ERC-1271 signature validation failed for your EIP-7702 wallet. Retry the smoke test; if it " +
      "persists, confirm the server RPC sees the same wallet delegation on Base."
    );
  }
  if (invalidReason.includes("smart_contract_wallet")) {
    return (
      "Payer address has contract bytecode on Base. USDC EIP-3009 requires a plain EOA signature for this flow."
    );
  }
  if (invalidReason.includes("undeployed_smart_wallet")) {
    return "Payer wallet is not deployed as an EOA on Base. x402 exact USDC requires a standard embedded wallet address.";
  }
  if (invalidReason.includes("transaction_simulation_failed")) {
    return undefined;
  }
  if (
    invalidReason.includes("authorization_valid_before") ||
    invalidReason.includes("expired")
  ) {
    return "Payment authorization expired. Run the smoke test again.";
  }
  if (invalidReason.includes("authorization_value_too_low")) {
    return "Signed amount is below the required payment.";
  }
  if (invalidReason.includes("signature")) {
    return "Payment signature verification failed. Confirm the server is on Base mainnet (chain 8453).";
  }
  if (invalidReason.includes("insufficient_funds")) {
    return "Insufficient USDC in your embedded wallet for this payment.";
  }

  return undefined;
}

export function parseX402ErrorResponse(
  responseBody?: string,
  options?: { clientUsdcReady?: boolean },
): X402ErrorDetails | null {
  if (!responseBody?.trim().startsWith("{")) return null;

  try {
    const parsed = JSON.parse(responseBody) as {
      error?: string;
      message?: string;
      invalidReason?: string;
      simulationRevert?: string;
    };
    const invalidReason = parsed.invalidReason ?? parsed.message;
    const simulationRevert = parsed.simulationRevert ?? "";
    const friendlyFromRevert = formatX402SimulationRevert(simulationRevert);
    const friendly = friendlyFromRevert ?? formatX402VerifyFailure(invalidReason, options);
    let message = friendly ?? parsed.message ?? parsed.error ?? responseBody;
    if (simulationRevert && !message.includes(simulationRevert)) {
      message = `${message} Revert: ${simulationRevert}`;
    }
    return {
      message,
      invalidReason: parsed.invalidReason ?? (invalidReason !== message ? invalidReason : undefined),
    };
  } catch {
    return null;
  }
}

export function formatX402ClientError(
  error: unknown,
  responseBody?: string,
  options?: { clientUsdcReady?: boolean },
): string {
  if (responseBody?.includes("This page didn't load")) {
    return "Server error during x402 payment (check EVM_RPC_URL, EVM_PRIVATE_KEY gas, and server logs).";
  }

  const parsed = parseX402ErrorResponse(responseBody, options);
  if (parsed) {
    if (parsed.invalidReason && parsed.message !== parsed.invalidReason) {
      return `${parsed.message} (${parsed.invalidReason})`;
    }
    return parsed.message;
  }

  if (error instanceof Error) {
    const friendly = formatX402VerifyFailure(error.message, options);
    return friendly ?? error.message;
  }

  return "x402 smoke test failed";
}
