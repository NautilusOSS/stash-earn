import { describe, expect, it } from "vitest";

import { GAUNTLET_USDC_PRIME_VAULT, STEAKHOUSE_PRIME_USDC_VAULT } from "@/lib/privy/vaults";
import {
  DEFAULT_AUTO_EARN_DESTINATION,
  getDorkFiEarnHint,
  isDorkFiEarnAvailable,
  parseAutoEarnDestination,
  resolveAutoEarnTarget,
} from "../auto-earn";

const dorkFiBridgeReady = {
  dorkFiExecutionReady: true,
  usdcOptedIn: false,
  voiBridgeConfigured: true,
  dorkFiUsdcBalance: 0,
  walletBaseBalance: 25,
} as const;

describe("auto-earn", () => {
  it("defaults invalid metadata to the default earn vault", () => {
    expect(parseAutoEarnDestination(undefined)).toBe(DEFAULT_AUTO_EARN_DESTINATION);
    expect(parseAutoEarnDestination("invalid")).toBe(DEFAULT_AUTO_EARN_DESTINATION);
    expect(parseAutoEarnDestination("earn_vault")).toBe(STEAKHOUSE_PRIME_USDC_VAULT.id);
  });

  it("parses stored preferences", () => {
    expect(parseAutoEarnDestination("dorkfi")).toBe("dorkfi");
    expect(parseAutoEarnDestination("highest_yield")).toBe("highest_yield");
    expect(parseAutoEarnDestination(GAUNTLET_USDC_PRIME_VAULT.id)).toBe(
      GAUNTLET_USDC_PRIME_VAULT.id,
    );
  });

  it("picks highest yield when both rails are available", () => {
    expect(
      resolveAutoEarnTarget({
        preference: "highest_yield",
        earnVaultApyDecimals: {
          [GAUNTLET_USDC_PRIME_VAULT.id]: 0.04,
          [STEAKHOUSE_PRIME_USDC_VAULT.id]: 0.05,
        },
        dorkFiApyDecimal: 0.06,
        earnConfigured: true,
        ...dorkFiBridgeReady,
      }),
    ).toBe("dorkfi");

    expect(
      resolveAutoEarnTarget({
        preference: "highest_yield",
        earnVaultApyDecimals: {
          [GAUNTLET_USDC_PRIME_VAULT.id]: 0.04,
          [STEAKHOUSE_PRIME_USDC_VAULT.id]: 0.07,
        },
        dorkFiApyDecimal: 0.05,
        earnConfigured: true,
        dorkFiExecutionReady: true,
        usdcOptedIn: true,
        voiBridgeConfigured: true,
        dorkFiUsdcBalance: 10,
      }),
    ).toBe(STEAKHOUSE_PRIME_USDC_VAULT.id);
  });

  it("falls back when only one rail is ready", () => {
    expect(
      resolveAutoEarnTarget({
        preference: "highest_yield",
        earnVaultApyDecimals: {
          [STEAKHOUSE_PRIME_USDC_VAULT.id]: 0.04,
        },
        dorkFiApyDecimal: 0.08,
        earnConfigured: true,
        dorkFiExecutionReady: false,
        usdcOptedIn: false,
        voiBridgeConfigured: true,
      }),
    ).toBe(STEAKHOUSE_PRIME_USDC_VAULT.id);
  });

  it("routes vault preferences to the selected vault", () => {
    expect(
      resolveAutoEarnTarget({
        preference: GAUNTLET_USDC_PRIME_VAULT.id,
        earnVaultApyDecimals: {},
        dorkFiApyDecimal: 0.06,
        earnConfigured: true,
        dorkFiExecutionReady: true,
        usdcOptedIn: true,
        voiBridgeConfigured: true,
      }),
    ).toBe(GAUNTLET_USDC_PRIME_VAULT.id);
  });

  it("allows DorkFi when bridge is configured even before USDC opt-in", () => {
    expect(
      resolveAutoEarnTarget({
        preference: "dorkfi",
        earnVaultApyDecimals: {},
        dorkFiApyDecimal: 0.06,
        earnConfigured: true,
        ...dorkFiBridgeReady,
      }),
    ).toBe("dorkfi");
  });

  it("allows DorkFi without bridge when Voi USDC is already funded", () => {
    expect(
      resolveAutoEarnTarget({
        preference: "dorkfi",
        earnVaultApyDecimals: {},
        dorkFiApyDecimal: 0.06,
        earnConfigured: true,
        dorkFiExecutionReady: true,
        usdcOptedIn: true,
        voiBridgeConfigured: false,
        dorkFiUsdcBalance: 5,
      }),
    ).toBe("dorkfi");
  });

  it("requires wallet USDC when bridging to Voi for DorkFi", () => {
    expect(
      isDorkFiEarnAvailable({
        dorkFiExecutionReady: true,
        usdcOptedIn: false,
        voiBridgeConfigured: true,
        dorkFiUsdcBalance: 0,
        walletBaseBalance: 0,
      }),
    ).toBe(false);

    expect(
      isDorkFiEarnAvailable({
        dorkFiExecutionReady: true,
        usdcOptedIn: false,
        voiBridgeConfigured: true,
        dorkFiUsdcBalance: 0,
        walletBaseBalance: 25,
      }),
    ).toBe(true);
  });

  it("requires opt-in when USDC is already on Voi", () => {
    expect(
      isDorkFiEarnAvailable({
        dorkFiExecutionReady: true,
        usdcOptedIn: false,
        voiBridgeConfigured: true,
        dorkFiUsdcBalance: 5,
      }),
    ).toBe(false);
  });

  it("describes the bridge-and-supply path for DorkFi", () => {
    expect(
      getDorkFiEarnHint({
        available: true,
        voiBridgeConfigured: true,
        dorkFiUsdcBalance: 0,
        walletBaseBalance: 10,
        usdcOptedIn: false,
        supplyApyLabel: "4.50%",
      }),
    ).toBe("Opts into USDC, sends to Voi, then supplies to pool · 4.50% APY");
  });
});
