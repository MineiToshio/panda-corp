/**
 * WO-09-006 — snapshotGamificationLedger Server Action integration test (RED phase)
 *
 * Tests that the server action:
 *   - writes the ledger only when needsSnapshot() returns true (AC-09-006.2)
 *   - does NOT write when live values are already captured in ledger
 *   - writes valid JSON that can be re-read by readLedger
 *   - resolves atomically (read → compare → write, no partial writes)
 *
 * Traceability: AC-09-006.1, AC-09-006.2
 */
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GuildOutcomes } from "@/lib/gamification/gamification";
import { readLedger } from "@/lib/gamification/ledger";

// We import the action via a direct import (not module mock) to test the real logic.
// The factory root is overridden via the PANDACORP_FACTORY_ROOT env var pattern used in config.ts.
// Instead, we test the action directly by passing the ledger path through a factory root override.

// Note: the Server Action reads the ledger path by calling resolveFactoryRoot() and computing
// path.join(root, "factory/gamification-ledger.json"). We override PANDACORP_FACTORY_ROOT
// per test via the env to point to our tmp dir.

let tmpFactory: string;

beforeEach(() => {
  tmpFactory = join(tmpdir(), `snapshot-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  // Create the factory/gamification sub-structure (matching the real path)
  mkdirSync(join(tmpFactory, "factory"), { recursive: true });
  process.env.PANDACORP_FACTORY_ROOT = tmpFactory;
});

afterEach(() => {
  rmSync(tmpFactory, { recursive: true, force: true });
  delete process.env.PANDACORP_FACTORY_ROOT;
  vi.restoreAllMocks();
});

const LIVE_WITH_PROGRESS: GuildOutcomes = {
  workOrdersDone: 25,
  phasesCompleted: 5,
  releases: 1,
  greenTestRuns: 100,
  weeklyStreak: 3,
};

const LIVE_ZERO: GuildOutcomes = {
  workOrdersDone: 0,
  phasesCompleted: 0,
  releases: 0,
  greenTestRuns: 0,
  weeklyStreak: 0,
};

describe("snapshotGamificationLedger", () => {
  it("writes the ledger when no prior ledger exists (first snapshot)", async () => {
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger(LIVE_WITH_PROGRESS);

    const ledgerPath = join(tmpFactory, "factory", "gamification-ledger.json");
    const written = readLedger(ledgerPath);

    expect(written.totals.workOrdersDone).toBe(25);
    expect(written.totals.phasesCompleted).toBe(5);
    expect(written.totals.releases).toBe(1);
    expect(written.version).toBe(1);
    expect(written.updatedAt).toBeTruthy();
  });

  it("writes a valid ISO date for updatedAt", async () => {
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger(LIVE_WITH_PROGRESS);

    const ledgerPath = join(tmpFactory, "factory", "gamification-ledger.json");
    const written = readLedger(ledgerPath);
    // Must be a parseable date
    expect(new Date(written.updatedAt).getTime()).toBeGreaterThan(0);
  });

  it("does NOT write when live values are all at zero (cold start — needsSnapshot false)", async () => {
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger(LIVE_ZERO);

    const ledgerPath = join(tmpFactory, "factory", "gamification-ledger.json");
    // File should NOT be created when nothing has been earned
    expect(() => readFileSync(ledgerPath, "utf8")).toThrow();
  });

  it("does NOT write when live values are already at or below the stored ledger", async () => {
    // Pre-write a high ledger
    const { writeFileSync } = await import("node:fs");
    const ledgerPath = join(tmpFactory, "factory", "gamification-ledger.json");
    const priorLedger = {
      version: 1,
      updatedAt: "2026-06-01T00:00:00Z",
      totals: { workOrdersDone: 100, phasesCompleted: 50, releases: 10 },
    };
    writeFileSync(ledgerPath, JSON.stringify(priorLedger), "utf8");

    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger(LIVE_WITH_PROGRESS);

    // File should NOT be overwritten since live < ledger
    const content = readFileSync(ledgerPath, "utf8");
    const parsed: { totals: { workOrdersDone: number } } = JSON.parse(content);
    // The original ledger's higher value should still be there (not overwritten with lower)
    expect(parsed.totals.workOrdersDone).toBe(100);
  });

  it("updates the ledger when live exceeds the stored value on any metric (AC-09-006.2)", async () => {
    const { writeFileSync } = await import("node:fs");
    const ledgerPath = join(tmpFactory, "factory", "gamification-ledger.json");
    const priorLedger = {
      version: 1,
      updatedAt: "2026-06-01T00:00:00Z",
      totals: { workOrdersDone: 10, phasesCompleted: 2, releases: 0 },
    };
    writeFileSync(ledgerPath, JSON.stringify(priorLedger), "utf8");

    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger(LIVE_WITH_PROGRESS);

    const updated = readLedger(ledgerPath);
    // live (25) > prior ledger (10)
    expect(updated.totals.workOrdersDone).toBe(25);
    expect(updated.totals.phasesCompleted).toBe(5);
    expect(updated.totals.releases).toBe(1);
  });

  it("stores MAX(live, ledger) so no metric ever decreases (AC-09-006.1 invariant)", async () => {
    const { writeFileSync } = await import("node:fs");
    const ledgerPath = join(tmpFactory, "factory", "gamification-ledger.json");
    // Ledger has higher phasesCompleted but lower workOrdersDone
    const priorLedger = {
      version: 1,
      updatedAt: "2026-06-01T00:00:00Z",
      totals: { workOrdersDone: 5, phasesCompleted: 99, releases: 0 },
    };
    writeFileSync(ledgerPath, JSON.stringify(priorLedger), "utf8");

    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    await snapshotGamificationLedger(LIVE_WITH_PROGRESS); // workOrdersDone=25, phasesCompleted=5

    const updated = readLedger(ledgerPath);
    expect(updated.totals.workOrdersDone).toBe(25); // MAX(25, 5) = 25
    expect(updated.totals.phasesCompleted).toBe(99); // MAX(5, 99) = 99 — never decreases
  });

  it("resolves to void (fire-and-forget — does not return a value)", async () => {
    const { snapshotGamificationLedger } = await import("@/app/_actions/snapshotLedger");
    const result = await snapshotGamificationLedger(LIVE_WITH_PROGRESS);
    expect(result).toBeUndefined();
  });
});
