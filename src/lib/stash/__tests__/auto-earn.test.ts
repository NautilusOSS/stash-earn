import { describe, expect, it } from "vitest";

import {
  DEFAULT_AUTO_EARN_DESTINATION,
  parseAutoEarnDestination,
  resolveAutoEarnTarget,
} from "../auto-earn";

describe("auto-earn", () => {
  it("defaults invalid metadata to earn vault", () => {
    expect(parseAutoEarnDestination(undefined)).toBe(DEFAULT_AUTO_EARN_DESTINATION);
    expect(parseAutoEarnDestination("invalid")).toBe(DEFAULT_AUTO_EARN_DESTINATION);
  });

  it("parses stored preferences", () => {
    expect(parseAutoEarnDestination("dorkfi")).toBe("dorkfi");
    expect(parseAutoEarnDestination("highest_yield")).toBe("highest_yield");
  });

  it("picks highest yield when both rails are available", () => {
    expect(
      resolveAutoEarnTarget({
        preference: "highest_yield",
        earnApyDecimal: 0.04,
        dorkFiApyDecimal: 0.06,
        earnConfigured: true,
        dorkFiExecutionReady: true,
        x402BridgeConfigured: true,
        dorkFiUsdcBalance: 0,
      }),
    ).toBe("dorkfi");

    expect(
      resolveAutoEarnTarget({
        preference: "highest_yield",
        earnApyDecimal: 0.07,
        dorkFiApyDecimal: 0.05,
        earnConfigured: true,
        dorkFiExecutionReady: true,
        x402BridgeConfigured: true,
        dorkFiUsdcBalance: 10,
      }),
    ).toBe("earn_vault");
  });

  it("falls back when only one rail is ready", () => {
    expect(
      resolveAutoEarnTarget({
        preference: "highest_yield",
        earnApyDecimal: 0.04,
        dorkFiApyDecimal: 0.08,
        earnConfigured: true,
        dorkFiExecutionReady: false,
        x402BridgeConfigured: true,
      }),
    ).toBe("earn_vault");
  });

  it("allows DorkFi when execution is ready and bridge is configured", () => {
    expect(
      resolveAutoEarnTarget({
        preference: "dorkfi",
        earnApyDecimal: 0.04,
        dorkFiApyDecimal: 0.06,
        earnConfigured: true,
        dorkFiExecutionReady: true,
        x402BridgeConfigured: true,
        dorkFiUsdcBalance: 0,
      }),
    ).toBe("dorkfi");
  });

  it("allows DorkFi without bridge when Voi USDC is already funded", () => {
    expect(
      resolveAutoEarnTarget({
        preference: "dorkfi",
        earnApyDecimal: 0.04,
        dorkFiApyDecimal: 0.06,
        earnConfigured: true,
        dorkFiExecutionReady: true,
        x402BridgeConfigured: false,
        dorkFiUsdcBalance: 5,
      }),
    ).toBe("dorkfi");
  });
});
