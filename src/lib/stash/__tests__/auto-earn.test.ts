import { describe, expect, it } from "vitest";

import { GAUNTLET_USDC_PRIME_VAULT, STEAKHOUSE_PRIME_USDC_VAULT } from "@/lib/privy/vaults";
import {
  DEFAULT_AUTO_EARN_DESTINATION,
  parseAutoEarnDestination,
  resolveAutoEarnTarget,
} from "../auto-earn";

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
        dorkFiExecutionReady: true,
        voiBridgeConfigured: true,
        dorkFiUsdcBalance: 0,
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
        voiBridgeConfigured: true,
      }),
    ).toBe(GAUNTLET_USDC_PRIME_VAULT.id);
  });

  it("allows DorkFi when execution is ready and bridge is configured", () => {
    expect(
      resolveAutoEarnTarget({
        preference: "dorkfi",
        earnVaultApyDecimals: {},
        dorkFiApyDecimal: 0.06,
        earnConfigured: true,
        dorkFiExecutionReady: true,
        voiBridgeConfigured: true,
        dorkFiUsdcBalance: 0,
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
        voiBridgeConfigured: false,
        dorkFiUsdcBalance: 5,
      }),
    ).toBe("dorkfi");
  });
});
