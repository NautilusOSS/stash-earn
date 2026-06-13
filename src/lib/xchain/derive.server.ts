import { ALGO_X_EVM_LSIG_TEAL, hexToBytes } from "@/lib/xchain/sdk.server";
import algosdk from "algosdk";

import {
  VOI_XCHAIN_EXECUTION_TEAL,
  XCHAIN_CANONICAL_LOGIC_VERSION,
  XCHAIN_PROTOCOL,
  VOI_EXECUTION_LOGIC_VERSION,
} from "@/lib/xchain/constants";
import type { XChainDerivedAddresses } from "@/lib/xchain/types";
import { validateEvmAddress } from "@/lib/xchain/validate";
import { getVoiAlgorandClient } from "@/lib/voi/client.server";

type TealVariant = "canonical" | "execution";

const compiledCache = new Map<string, Uint8Array>();

function normalizeEvmHex(evmAddress: `0x${string}`): string {
  return evmAddress.slice(2).toLowerCase();
}

function getTealForVariant(variant: TealVariant): string {
  return variant === "canonical" ? ALGO_X_EVM_LSIG_TEAL : VOI_XCHAIN_EXECUTION_TEAL;
}

async function getCompiledProgram(
  evmAddress: `0x${string}`,
  variant: TealVariant,
): Promise<Uint8Array> {
  const cacheKey = `${normalizeEvmHex(evmAddress)}:${variant}`;
  const cached = compiledCache.get(cacheKey);
  if (cached) return cached;

  const algorand = getVoiAlgorandClient();
  const teal = getTealForVariant(variant);

  try {
    const result = await algorand.app.compileTealTemplate(teal, {
      TMPL_OWNER: hexToBytes(normalizeEvmHex(evmAddress)),
    });
    compiledCache.set(cacheKey, result.compiledBase64ToBytes);
    return result.compiledBase64ToBytes;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown algod compile error";
    throw new Error(`Failed to compile xChain TEAL on Voi algod: ${message}`);
  }
}

function addressFromProgram(program: Uint8Array): string {
  return new algosdk.LogicSigAccount(program, []).address().toString();
}

export async function deriveXChainAddresses(evmAddress: string): Promise<XChainDerivedAddresses> {
  const validation = validateEvmAddress(evmAddress);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const normalized = validation.normalized;
  const [canonicalProgram, executionProgram] = await Promise.all([
    getCompiledProgram(normalized, "canonical"),
    getCompiledProgram(normalized, "execution"),
  ]);

  return {
    evmAddress: normalized,
    voiAddress: addressFromProgram(canonicalProgram),
    voiExecutionAddress: addressFromProgram(executionProgram),
    logicVersion: XCHAIN_CANONICAL_LOGIC_VERSION,
    voiExecutionLogicVersion: VOI_EXECUTION_LOGIC_VERSION,
    protocol: XCHAIN_PROTOCOL,
    isDeterministic: true,
  };
}

export async function getExecutionCompiledProgram(evmAddress: `0x${string}`): Promise<Uint8Array> {
  return getCompiledProgram(evmAddress, "execution");
}

export async function getCanonicalCompiledProgram(evmAddress: `0x${string}`): Promise<Uint8Array> {
  return getCompiledProgram(evmAddress, "canonical");
}
