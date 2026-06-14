import { describe, expect, it } from "vitest";

import {
  estimateAnnualYield,
  resolveCompositeYield,
} from "../composite-yield";

describe("resolveCompositeYield", () => {
  it("weights earn and DorkFi APY by USDC balance", () => {
    const result = resolveCompositeYield({
      totalBalance: 100,
      earnBalance: 80,
      earnApyDecimal: 0.05,
      dorkFiBalance: 20,
      dorkFiApyDecimal: 0.08,
    });

    expect(result?.decimal).toBeCloseTo(0.056);
    expect(result?.label).toBe("5.60%");
  });

  it("treats idle wallet USDC as 0% yield", () => {
    const result = resolveCompositeYield({
      totalBalance: 100,
      earnBalance: 50,
      earnApyDecimal: 0.1,
      dorkFiBalance: 0,
      dorkFiApyDecimal: 0.08,
    });

    expect(result?.decimal).toBeCloseTo(0.05);
  });

  it("estimates annual yield from total balance and composite APY", () => {
    expect(estimateAnnualYield(100, 0.056)).toBeCloseTo(5.6);
    expect(estimateAnnualYield(100, null)).toBeNull();
    expect(estimateAnnualYield(0, 0.05)).toBeNull();
  });
});
