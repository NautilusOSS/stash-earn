/**
 * Voi aUSDC lending deposit txn builder.
 *
 * Mirrors dorkfi-app `lendingService.deposit` ASA path for Voi mainnet:
 * https://github.com/DorkFi/dorkfi-app/blob/next/src/services/lendingService.ts#L4230
 */
import algosdk from "algosdk";
import { abi, CONTRACT } from "ulujs";
import { createRequire } from "module";

import { getVoiAlgodClient } from "@/lib/voi/client.server";
import { VOI_MAINNET_A_MARKET_USDC } from "./constants";

const require = createRequire(import.meta.url);
const lendingPoolABI = require("dorkfi-mcp/data/lending-pool-abi.json");

const VOI_ORACLE_APP_ID = 47138065;

function encodeNote(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function poolAppAddress(poolId: number): string {
  return algosdk.encodeAddress(algosdk.getApplicationAddress(poolId).publicKey);
}

function makeSigner(sender: string) {
  return { addr: sender, sk: new Uint8Array() };
}

/**
 * Build unsigned deposit txn group for ASA aUSDC on Voi.
 * `amountAtomic` is micro-USDC base units (same as lendingService `amount` param).
 */
export async function buildVoiUsdcLendingDepositTxns(params: {
  sender: string;
  amountAtomic: bigint;
}): Promise<{ transactions: string[]; amountAtomic: string }> {
  if (params.amountAtomic <= 0n) {
    throw new Error("Deposit amount must be positive");
  }

  const market = VOI_MAINNET_A_MARKET_USDC;
  const algod = getVoiAlgodClient();
  const signer = makeSigner(params.sender);
  const poolAddrStr = poolAppAddress(market.poolId);

  const ci = new CONTRACT(market.poolId, algod, undefined, abi.custom, signer);
  const lending = new CONTRACT(
    market.poolId,
    algod,
    undefined,
    { ...lendingPoolABI, events: [] },
    signer,
    true,
    false,
    true,
  );
  const token = new CONTRACT(
    market.contractId,
    algod,
    undefined,
    abi.nt200,
    signer,
    true,
    false,
    true,
  );

  const arc200ApproveAndLendingAmount = params.amountAtomic;
  const approvalAmount = (arc200ApproveAndLendingAmount * 11n) / 10n;
  const foreignApps = [VOI_ORACLE_APP_ID];
  const depositNoteSymbol = market.symbol;

  let customTx: { success: boolean; txns?: string[]; error?: string } | undefined;

  for (const [p1, p2, p3] of [
    [0, 0, 0],
    [0, 1, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 0, 1],
    [0, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ] as const) {
    const buildN: Record<string, unknown>[] = [];

    const nt200DepositTxn = (await token.deposit(arc200ApproveAndLendingAmount)).obj;
    buildN.push({
      ...nt200DepositTxn,
      payment: p1 > 0 ? 28501 : 0,
      aamt: arc200ApproveAndLendingAmount,
      xaid: market.underlyingAssetId,
      note: encodeNote(
        `nt200 deposit ${params.amountAtomic.toString()} ${depositNoteSymbol}`,
      ),
    });

    const approveTxn = (
      await token.arc200_approve(poolAddrStr, approvalAmount)
    ).obj;
    buildN.push({
      ...approveTxn,
      payment: p2 > 0 ? 28502 : 0,
      note: encodeNote(`arc200 approve ${approvalAmount.toString()} ${depositNoteSymbol}`),
    });

    const lendingDepositTxn = (
      await lending.deposit(market.marketId, arc200ApproveAndLendingAmount)
    ).obj;
    buildN.push({
      ...lendingDepositTxn,
      payment: p3 > 0 ? 9e5 : 1e5,
      foreignApps,
      note: encodeNote(
        `lending deposit ${arc200ApproveAndLendingAmount.toString()} ${depositNoteSymbol}`,
      ),
    });

    ci.setFee(20000);
    ci.setEnableGroupResourceSharing(true);
    ci.setExtraTxns(buildN);
    customTx = await ci.custom();
    if (customTx.success) break;
  }

  if (!customTx?.success || !customTx.txns?.length) {
    const detail = customTx?.error ?? "Failed to build supply transaction";
    if (/tried to spend/i.test(detail)) {
      throw new Error(detail);
    }
    throw new Error("Deposit transaction failed");
  }

  return {
    transactions: customTx.txns,
    amountAtomic: params.amountAtomic.toString(),
  };
}
