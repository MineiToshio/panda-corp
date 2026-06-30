/**
 * WO-09-006 — ADVERSARIAL reviewer tests (DR-015) for the gamification ledger.
 *
 * Edge cases / abuse the implementer did NOT cover, exercised through the REAL
 * production resolution path (default factory path via PANDACORP_FACTORY_ROOT) and
 * the REAL merge→level chain — not isolated pure-function fixtures.
 *
 * Anchored in:
 *   - AC-09-006.1 (deleting a project NEVER decreases XP/level) — exercised end-to-end
 *     through mergeLedgerOutcomes → computeGuildLevel.
 *   - AC-09-006.3 / DR-078 (read boundary fails SAFE, never throws, never inflates) —
 *     malformed-fixture via the DEFAULT path, the seam guildState.readGuildState() uses.
 *   - The implementer's own "pre-merge vs post-merge" hazard: a hand-edited ledger with
 *     hostile values (negative, NaN, Infinity, fractional, huge) must not crash the level
 *     computation nor produce a non-finite / negative level.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeGuildLevel, type GuildOutcomes } from "@/lib/gamification/gamification";
import { mergeLedgerOutcomes, readLedger } from "@/lib/gamification/ledger";

let tmpFactory: string;
let ledgerPath: string;

beforeEach(() => {
  tmpFactory = join(tmpdir(), `ledger-adv-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(tmpFactory, "factory"), { recursive: true });
  ledgerPath = join(tmpFactory, "factory", "gamification-ledger.json");
  process.env.PANDACORP_FACTORY_ROOT = tmpFactory;
});

afterEach(() => {
  rmSync(tmpFactory, { recursive: true, force: true });
  delete process.env.PANDACORP_FACTORY_ROOT;
});

const ZERO_LIVE: GuildOutcomes = {
  workOrdersDone: 0,
  phasesCompleted: 0,
  releases: 0,
  greenTestRuns: 0,
  weeklyStreak: 0,
};

// ---------------------------------------------------------------------------
// DR-078 — the DEFAULT-path read boundary (the seam readGuildState() uses)
// ---------------------------------------------------------------------------

describe("readLedger via the DEFAULT factory path (the production seam) — DR-078", () => {
  it("a corrupt ledger at the DEFAULT path fails SAFE (zero-totals, never throws)", () => {
    // The seam in guildState.readGuildState() calls readLedger() with NO argument,
    // resolving factory/gamification-ledger.json via resolveFactoryRoot(). A corrupt
    // file on disk there must not crash the dashboard render.
    writeFileSync(ledgerPath, '{"totals": "this is not an object", broken', "utf8");

    expect(() => readLedger()).not.toThrow();
    const ledger = readLedger();
    expect(ledger.totals.workOrdersDone).toBe(0);
    expect(ledger.totals.phasesCompleted).toBe(0);
    expect(ledger.totals.releases).toBe(0);
  });

  it("a totals object with hostile values is sanitized at the DEFAULT path (never inflates)", () => {
    // A hand-edited ledger (personal, gitignored — the owner CAN edit it) with hostile
    // numbers must be coerced, never trusted: negatives, NaN, Infinity, fractional.
    writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        updatedAt: "2026-06-29T00:00:00Z",
        totals: {
          workOrdersDone: -500,
          phasesCompleted: Number.NaN, // JSON.stringify → null, but be defensive
          releases: 3.9,
        },
      }),
      "utf8",
    );

    const ledger = readLedger();
    // negative → clamped to 0 (never a NEGATIVE floor that would crash level math)
    expect(ledger.totals.workOrdersDone).toBe(0);
    // NaN/null → 0
    expect(ledger.totals.phasesCompleted).toBe(0);
    // fractional → truncated to a natural number
    expect(ledger.totals.releases).toBe(3);
    expect(Number.isInteger(ledger.totals.releases)).toBe(true);
  });

  it("an Infinity in the JSON (smuggled as a huge number) is coerced, not propagated", () => {
    // JSON can't carry Infinity, but 1e400 parses to Infinity. The level math must
    // never receive a non-finite floor.
    writeFileSync(
      ledgerPath,
      '{"version":1,"updatedAt":"x","totals":{"workOrdersDone":1e400,"phasesCompleted":0,"releases":0}}',
      "utf8",
    );

    const ledger = readLedger();
    expect(Number.isFinite(ledger.totals.workOrdersDone)).toBe(true);
    expect(ledger.totals.workOrdersDone).toBe(0); // _safeNat rejects non-finite
  });
});

// ---------------------------------------------------------------------------
// AC-09-006.1 — END-TO-END level preservation (merge → computeGuildLevel)
// ---------------------------------------------------------------------------

describe("AC-09-006.1 end-to-end: deleting a project never lowers the LEVEL", () => {
  it("level computed from MAX(live, ledger) >= level from live alone after a deletion", () => {
    // Simulate: the guild earned a high historical maximum (stored in the ledger),
    // then a project is deleted so the LIVE outcomes drop to zero.
    writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        updatedAt: "2026-06-25T00:00:00Z",
        totals: { workOrdersDone: 120, phasesCompleted: 18, releases: 4 },
      }),
      "utf8",
    );

    const ledger = readLedger();

    // The level the guild SHOWS (merged) must not collapse to the zero-live level.
    const liveLevel = computeGuildLevel(ZERO_LIVE);
    const mergedLevel = computeGuildLevel(mergeLedgerOutcomes(ZERO_LIVE, ledger));

    expect(mergedLevel.level).toBeGreaterThan(liveLevel.level);
    expect(mergedLevel.xp).toBeGreaterThan(liveLevel.xp);
    // The floor is honest: it equals exactly the level the ledger totals would produce.
    const ledgerOnlyLevel = computeGuildLevel({
      ...ZERO_LIVE,
      workOrdersDone: 120,
      phasesCompleted: 18,
      releases: 4,
    });
    expect(mergedLevel.level).toBe(ledgerOnlyLevel.level);
  });

  it("the merged level is monotonic: live growth past the ledger only ever raises it", () => {
    writeFileSync(
      ledgerPath,
      JSON.stringify({
        version: 1,
        updatedAt: "x",
        totals: { workOrdersDone: 50, phasesCompleted: 5, releases: 1 },
      }),
      "utf8",
    );
    const ledger = readLedger();

    const atFloor = computeGuildLevel(
      mergeLedgerOutcomes(
        { ...ZERO_LIVE, workOrdersDone: 50, phasesCompleted: 5, releases: 1 },
        ledger,
      ),
    );
    const above = computeGuildLevel(
      mergeLedgerOutcomes(
        { ...ZERO_LIVE, workOrdersDone: 90, phasesCompleted: 9, releases: 2 },
        ledger,
      ),
    );
    expect(above.level).toBeGreaterThanOrEqual(atFloor.level);
    expect(above.xp).toBeGreaterThan(atFloor.xp);
  });
});

// ---------------------------------------------------------------------------
// The "pre-merge vs post-merge" hazard the implementer flagged (idempotency)
// ---------------------------------------------------------------------------

describe("merge idempotency — feeding a merged value back must not double-count", () => {
  it("mergeLedgerOutcomes is idempotent: merge(merge(live, l), l) === merge(live, l)", () => {
    const live: GuildOutcomes = {
      workOrdersDone: 10,
      phasesCompleted: 3,
      releases: 1,
      greenTestRuns: 7,
      weeklyStreak: 2,
    };
    const ledger = {
      version: 1 as const,
      updatedAt: "x",
      totals: { workOrdersDone: 40, phasesCompleted: 2, releases: 0 },
    };
    const once = mergeLedgerOutcomes(live, ledger);
    const twice = mergeLedgerOutcomes(once, ledger);
    // MAX is idempotent — re-applying the ledger floor cannot grow the value.
    expect(twice).toEqual(once);
  });
});
