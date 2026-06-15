import { describe, expect, it } from "vitest";

import {
  EXECUTION_VOI_TOP_UP_VOI,
  MIN_EXECUTION_SPENDABLE_VOI,
} from "@/lib/voi/avm-voi-transfer.server";

describe("avm-voi-transfer", () => {
  it("tops up when spendable VOI is below 1 and sends 1 VOI", () => {
    expect(MIN_EXECUTION_SPENDABLE_VOI).toBe(1);
    expect(EXECUTION_VOI_TOP_UP_VOI).toBe(1);
  });
});
