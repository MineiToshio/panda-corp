/**
 * RED → GREEN tests for the O(1) aggregate CONSUMPTION path (FRD-23, WO-23-004, REQ-23-003).
 *
 * AC-23-003.1 has two clauses: (a) `sync-portfolio` JOINS the N portadas into one file (covered by
 * `aggregate.test.ts`), and (b) MC READS that one file in O(1). The MC render reads the aggregate
 * ONCE (`readStatsAggregate`) and passes the result to `resolvePortadaFromAggregate`, which picks +
 * seal-validates the current project's entry and returns a `PortadaResult` — the same shape
 * `readStatsPortada` returns, so the Informe wiring (`resolveInformeSources`) is unchanged.
 *
 * Fail-loud honesty (DR-078): a missing / unparseable aggregate, an absent project entry, OR a stale
 * entry all fall back to the per-project reader (`readStatsPortada`) — never a fabricated zero. The
 * aggregate join may hold independently-stale entries (it does not seal-validate at join time), so
 * the seal is re-checked HERE at the point of use before an aggregate entry is trusted.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePortadaFromAggregate } from "../aggregateConsumer";
import { currentSeal } from "../seal";
import type { AggregateResult } from "../statsReader";
import type { StatsAggregate } from "../statsSchema";
import { FIXTURE_SEAL, makePortada } from "./fixtures";

vi.mock("../seal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../seal")>();
  return { ...actual, currentSeal: vi.fn() };
});

const mockedCurrentSeal = vi.mocked(currentSeal);

let dir: string;
let projectDir: string;

/** Write a real production-shape portada into <projectDir>/.pandacorp/stats.json. */
function seedProjectPortada(seal: string): void {
  fs.mkdirSync(path.join(projectDir, ".pandacorp"), { recursive: true });
  fs.writeFileSync(
    path.join(projectDir, ".pandacorp", "stats.json"),
    `${JSON.stringify(makePortada({ seal }), null, 2)}\n`,
    "utf-8",
  );
}

/** An `{ ok: true }` aggregate result carrying the given projects record. */
function okAggregate(projects: Record<string, ReturnType<typeof makePortada>>): AggregateResult {
  return { ok: true, value: { projects } satisfies StatsAggregate };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "agg-consume-"));
  projectDir = path.join(dir, "mission-control");
  fs.mkdirSync(projectDir, { recursive: true });
  mockedCurrentSeal.mockReset();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("resolvePortadaFromAggregate — uses the fresh O(1) entry (AC-23-003.1)", () => {
  it("returns { ok: true, value } from the aggregate entry when its seal is fresh — no per-project git", () => {
    const aggregate = okAggregate({ "mission-control": makePortada({ seal: FIXTURE_SEAL }) });
    mockedCurrentSeal.mockReturnValue(FIXTURE_SEAL);

    const result = resolvePortadaFromAggregate(aggregate, "mission-control", projectDir);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.seal).toBe(FIXTURE_SEAL);
      expect(result.value.scalars.frds).toBe(23);
    }
    // The current project's seal is validated ONCE; no per-project stats.json read happened (the
    // entry came from the join) — so the seal check is against live git for this project only.
    expect(mockedCurrentSeal).toHaveBeenCalledWith(projectDir);
  });

  it("is independent of N: a 100-project aggregate resolves the current project with one seal check", () => {
    const projects: Record<string, ReturnType<typeof makePortada>> = {};
    for (let i = 0; i < 100; i++) {
      projects[`proj-${i}`] = makePortada({ seal: `${i}`.padStart(40, "0") });
    }
    projects["mission-control"] = makePortada({ seal: FIXTURE_SEAL });
    mockedCurrentSeal.mockReturnValue(FIXTURE_SEAL);

    const result = resolvePortadaFromAggregate(
      okAggregate(projects),
      "mission-control",
      projectDir,
    );
    expect(result.ok).toBe(true);
    // A single seal check for the current project — not N.
    expect(mockedCurrentSeal).toHaveBeenCalledTimes(1);
  });
});

describe("resolvePortadaFromAggregate — honest fallback (DR-078)", () => {
  it("falls back to readStatsPortada when the aggregate result is MISSING", () => {
    seedProjectPortada(FIXTURE_SEAL);
    mockedCurrentSeal.mockReturnValue(FIXTURE_SEAL);

    const result = resolvePortadaFromAggregate(
      { ok: false, reason: "missing" },
      "mission-control",
      projectDir,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.seal).toBe(FIXTURE_SEAL);
    }
  });

  it("falls back to readStatsPortada when the aggregate result is UNPARSEABLE — never a silent empty", () => {
    seedProjectPortada(FIXTURE_SEAL);
    mockedCurrentSeal.mockReturnValue(FIXTURE_SEAL);

    const result = resolvePortadaFromAggregate(
      { ok: false, reason: "unparseable" },
      "mission-control",
      projectDir,
    );
    expect(result.ok).toBe(true);
  });

  it("falls back when the current project has NO entry in the aggregate", () => {
    const aggregate = okAggregate({ "some-other-project": makePortada({ seal: "z".repeat(40) }) });
    seedProjectPortada(FIXTURE_SEAL);
    mockedCurrentSeal.mockReturnValue(FIXTURE_SEAL);

    const result = resolvePortadaFromAggregate(aggregate, "mission-control", projectDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.seal).toBe(FIXTURE_SEAL);
    }
  });

  it("falls back (stale) when the aggregate entry's seal is STALE — the join may hold stale entries", () => {
    // Aggregate entry carries an OLD seal; live git moved on. The per-project file is ALSO stale
    // here, so the whole chain degrades to `stale` (→ live git at the Informe layer).
    const aggregate = okAggregate({
      "mission-control": makePortada({ seal: "oldseal".padEnd(40, "0") }),
    });
    seedProjectPortada("oldseal".padEnd(40, "0"));
    mockedCurrentSeal.mockReturnValue("newseal".padEnd(40, "9"));

    const result = resolvePortadaFromAggregate(aggregate, "mission-control", projectDir);
    expect(result).toEqual({ ok: false, reason: "stale" });
  });

  it("uses the per-project portada when the aggregate entry is stale but the on-disk file is fresh", () => {
    // The aggregate lagged (stale entry) but the project was regenerated since the last sync — the
    // fresh on-disk portada wins via the fallback, so the Informe is not needlessly sent to live git.
    const aggregate = okAggregate({
      "mission-control": makePortada({ seal: "oldseal".padEnd(40, "0") }),
    });
    seedProjectPortada(FIXTURE_SEAL);
    mockedCurrentSeal.mockReturnValue(FIXTURE_SEAL);

    const result = resolvePortadaFromAggregate(aggregate, "mission-control", projectDir);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.seal).toBe(FIXTURE_SEAL);
    }
  });
});
