/**
 * FRD-06 — Party · La Fragua — REVIEWER adversarial FRD-gate integration test.
 *
 * Written by the FRD-06 review gate (Opus — a different model from the
 * implementers, DR-015). These exercise the work orders TOGETHER through the
 * REAL read→derive→render pipeline the production RSC tab uses:
 *
 *   real NDJSON (nested `data` shape) → readEvents (WO-06-012)
 *     → toFraguaSnapshot (WO-06-005) → FraguaScene/PartyTab (WO-06-006/011)
 *
 * Each test anchors an EARS criterion at an edge the implementers' own tests
 * and the prior reviewer tests did NOT cover:
 *
 *   AC-06-001.2  — wave cap holds in the RENDERED DOM (not just the snapshot)
 *                  on a noisy, duplicated, multi-mode real stream
 *   AC-06-002.1  — the scene FOLLOWS a mid-stream FRD switch; the previous
 *                  FRD's running WOs do NOT bleed into the new FRD's forge
 *   AC-06-005.2  — the Bóveda compacts to "+N archivados" beyond 9 trophies,
 *                  end-to-end from real achievement events (10+ verified)
 *   AC-06-007.3  — the deep contract path survives the real nested-`data`
 *                  ContractPublished shape through state-map
 *   AC-06-010.1  — a stream with events but NO `frd` field degrades to the
 *                  empty state (PartyTab), never a crash or a half-rendered scene
 *   AC-06-008.2  — a totally garbage tail (no required fields) never throws
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { readEvents } from "@/lib/events/events";
import { FraguaScene } from "../FraguaScene/FraguaScene";
import { toFraguaSnapshot } from "../fragua-snapshot/fragua-snapshot";
import { PartyTab } from "../PartyTab/PartyTab";
import { eventToVisual } from "../state-map/state-map";

// RAF mock — FraguaScene mounts a RAF loop; jsdom has no rAF. Static render only.
vi.stubGlobal("requestAnimationFrame", (_cb: FrameRequestCallback) => 0);
vi.stubGlobal("cancelAnimationFrame", (_id: number) => undefined);

const FRD = "frd-06-party";
const OTHER_FRD = "frd-10-achievements-hall";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd06-gate-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeLines(lines: string[]): string {
  const filePath = path.join(tmpDir, "dashboard-events.ndjson");
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf-8");
  return filePath;
}

/** The EXACT nested-`data` shape the real plugin emitter writes. */
function rWorking(wo: string, at: string, frd: string, mode = "powerful"): string {
  return JSON.stringify({
    event: "AgentWorking",
    at,
    project: "mission-control",
    data: { role: "implementer", wo, frd, phase: "build", activity: "implement", mode },
  });
}

function rAchievement(wo: string, at: string, frd: string): string {
  return JSON.stringify({
    event: "achievement",
    at,
    project: "mission-control",
    data: { role: "implementer", wo, frd },
  });
}

function ts(seconds: number): string {
  const base = Date.UTC(2026, 5, 18, 20, 0, 0) + seconds * 1000;
  return new Date(base).toISOString().replace(".000", "");
}

// ---------------------------------------------------------------------------
// AC-06-001.2 — wave cap holds in the rendered DOM on a noisy real stream
// ---------------------------------------------------------------------------

describe("frd-06 gate: wave cap is enforced in the rendered scene (AC-06-001.2)", () => {
  it("renders at most `wave` sprites even with 24 duplicated running events, mode=pro", () => {
    const lines: string[] = [];
    let t = 0;
    for (let n = 1; n <= 8; n++) {
      const wo = `WO-06-${String(n).padStart(3, "0")}`;
      // each WO appears 3x (duplicate/noisy stream), mode pro → wave 2
      lines.push(rWorking(wo, ts(t++), FRD, "pro"));
      lines.push(rWorking(wo, ts(t++), FRD, "pro"));
      lines.push(rWorking(wo, ts(t++), FRD, "pro"));
    }
    const p = writeLines(lines);
    const { events, lastEventAt } = readEvents({ path: p });
    const snap = toFraguaSnapshot(events, { lastEventAt });

    expect(snap.mode).toBe("pro");
    expect(snap.wave).toBe(2);

    render(<FraguaScene snapshot={snap} />);
    const sprites = screen.queryAllByTestId(/^fragua-wo-/);
    // The DOM must never render more sprites than the wave (FRD edge case line 82).
    expect(sprites.length).toBeLessThanOrEqual(2);
    expect(sprites.length).toBe(snap.running.length);
  });
});

// ---------------------------------------------------------------------------
// AC-06-002.1 — the scene follows a mid-stream FRD switch
// ---------------------------------------------------------------------------

describe("frd-06 gate: a mid-stream FRD switch re-targets the scene (AC-06-002.1)", () => {
  it("the previous FRD's running WOs do not bleed into the new FRD's forge", () => {
    const p = writeLines([
      // FRD-10 was building first…
      rWorking("WO-10-001", ts(0), OTHER_FRD, "powerful"),
      rWorking("WO-10-002", ts(1), OTHER_FRD, "powerful"),
      // …then the run advances to FRD-06 (the newest `frd` wins).
      rWorking("WO-06-001", ts(2), FRD, "powerful"),
      rWorking("WO-06-002", ts(3), FRD, "powerful"),
    ]);
    const { events, lastEventAt } = readEvents({ path: p });
    const snap = toFraguaSnapshot(events, { lastEventAt });

    // Scene must follow the newest FRD in build.
    expect(snap.frd?.id).toBe(FRD);
    const runningIds = snap.running.map((r) => r.wo);
    expect(runningIds).not.toContain("WO-10-001");
    expect(runningIds).not.toContain("WO-10-002");

    render(<FraguaScene snapshot={snap} />);
    // The forge must not render a sprite for the foreign FRD's WO.
    expect(screen.queryByTestId("fragua-wo-WO-10-001")).not.toBeInTheDocument();
    expect(screen.getByTestId("fragua-wo-WO-06-001")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-06-005.2 — Bóveda compacts to "+N archivados" beyond 9, end-to-end
// ---------------------------------------------------------------------------

describe("frd-06 gate: the Bóveda grows rows; 12 trophies all fit (AC-06-005.2)", () => {
  it("12 verified WOs → 12 trophies rendered, nothing archived", () => {
    const lines: string[] = [];
    let t = 0;
    // one active WO so the scene is live + 12 achievements on the current FRD
    lines.push(rWorking("WO-06-001", ts(t++), FRD, "powerful"));
    for (let n = 1; n <= 12; n++) {
      lines.push(rAchievement(`WO-06-${String(100 + n)}`, ts(t++), FRD));
    }
    const p = writeLines(lines);
    const { events, lastEventAt } = readEvents({ path: p });
    const snap = toFraguaSnapshot(events, { lastEventAt });

    expect(snap.trophies.length).toBe(12);
    expect(snap.archivedCount).toBe(0);

    render(<FraguaScene snapshot={snap} />);
    // `fragua-trophy-shelf` is the container — match only `fragua-trophy-<id>`.
    const trophies = screen.queryAllByTestId(/^fragua-trophy-WO-/);
    expect(trophies.length).toBe(12);
    // Nothing archived → no "+N más" indicator; the shelf grew a second row instead.
    expect(screen.queryByTestId("fragua-archived")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-06-007.3 — the deep contract path survives the real nested-data shape
// ---------------------------------------------------------------------------

describe("frd-06 gate: ContractPublished in real nested-data shape maps to publishContract (AC-06-007.3)", () => {
  it("a real-shape ContractPublished line yields a publishContract action via state-map", () => {
    const p = writeLines([
      JSON.stringify({
        event: "ContractPublished",
        at: ts(0),
        project: "mission-control",
        data: { wo: "WO-06-013", frd: FRD },
      }),
    ]);
    const { events } = readEvents({ path: p });
    // The single retained event must carry the WO from `data.wo` and map to the
    // contract hand-off action the deep relay renders (📄 between backend/frontend).
    expect(events).toHaveLength(1);
    const contractEvent = events[0];
    if (contractEvent === undefined) throw new Error("expected a retained event");
    const action = eventToVisual(contractEvent);
    expect(action).toEqual({ kind: "publishContract", wo: "WO-06-013" });
  });
});

// ---------------------------------------------------------------------------
// AC-06-010.1 — events present but no `frd` → empty state, never a crash
// ---------------------------------------------------------------------------

describe("frd-06 gate: a stream with events but no FRD degrades to the empty state (AC-06-010.1)", () => {
  it("PartyTab renders the empty state, not a half-built scene", () => {
    // Legacy/global events with no `frd` field at all (backward-compat path).
    const p = writeLines([
      JSON.stringify({ event: "AgentWorking", at: ts(0), agent: "backend-dev" }),
      JSON.stringify({ event: "SubagentStop", at: ts(1), agent: "backend-dev" }),
    ]);
    render(<PartyTab eventsPath={p} />);

    expect(screen.getByTestId("party-tab-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("fragua-scene")).not.toBeInTheDocument();
    // The header carries NO signal chip anymore — the DR-066 FreshnessBadge (live
    // shell) is the single freshness voice (owner, 2026-07-02).
    expect(screen.queryByTestId("party-tab-no-signal")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// AC-06-008.2 — a garbage tail never throws (fail-soft end to end)
// ---------------------------------------------------------------------------

describe("frd-06 gate: a fully malformed tail never throws (AC-06-008.2)", () => {
  it("garbage lines are skipped; PartyTab renders the empty state without throwing", () => {
    const p = writeLines([
      "not json at all",
      "{ broken",
      JSON.stringify(["array", "not", "object"]),
      JSON.stringify({ missing: "required fields" }),
      "42",
      "null",
    ]);
    expect(() => render(<PartyTab eventsPath={p} />)).not.toThrow();
    expect(screen.getByTestId("party-tab-empty")).toBeInTheDocument();
  });
});
