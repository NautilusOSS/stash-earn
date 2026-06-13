import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { SettledPayment } from "./types";

/**
 * Durable replay protection for settled x402 payments.
 * Uses a JSON file locally; swap for KV/Dynamo in production.
 */
export interface ReplayStore {
  has(paymentId: string): Promise<boolean>;
  record(payment: SettledPayment): Promise<void>;
}

type StoreFile = {
  payments: Record<string, SettledPayment>;
};

export class FileReplayStore implements ReplayStore {
  constructor(private readonly filePath: string) {}

  private async readStore(): Promise<StoreFile> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as StoreFile;
    } catch {
      return { payments: {} };
    }
  }

  private async writeStore(store: StoreFile): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(store, null, 2), "utf8");
  }

  async has(paymentId: string): Promise<boolean> {
    const store = await this.readStore();
    return paymentId in store.payments;
  }

  async record(payment: SettledPayment): Promise<void> {
    const store = await this.readStore();
    store.payments[payment.paymentId] = payment;
    await this.writeStore(store);
  }
}

/** In-memory store for unit tests. */
export class MemoryReplayStore implements ReplayStore {
  private payments = new Map<string, SettledPayment>();

  async has(paymentId: string): Promise<boolean> {
    return this.payments.has(paymentId);
  }

  async record(payment: SettledPayment): Promise<void> {
    this.payments.set(payment.paymentId, payment);
  }
}

let replayStore: ReplayStore | undefined;

export function getReplayStore(filePath: string): ReplayStore {
  if (!replayStore) {
    replayStore = new FileReplayStore(filePath);
  }
  return replayStore;
}

export function setReplayStoreForTests(store: ReplayStore): void {
  replayStore = store;
}
