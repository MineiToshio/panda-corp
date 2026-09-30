/**
 * Seal coverage (FRD-23, REQ-23-001/006/007): a FRESH portada must never serve a fact its
 * per-project seal (`git log -1 -- docs/frds .pandacorp/status.yaml`) does not validate.
 *
 * Three facts used to live in the portada while escaping that seal, so the Informe served them
 * stale even though the seal matched (drift proven with real data: sealed `commits=1096` vs live
 * `1101`, same seal):
 *   - `scalars.commits`  (`git rev-list --count HEAD`: any commit moves it)
 *   - `funnel`           (factory/ideas is gitignored + every project's status.yaml)
 *   - the ideas-per-week series (`weeklyFlow.ideasCaptured`/`ideasWithoutCreated`, factory/ideas)
 * They are live now; the portada keeps only the WO-verified series and the FRD count.
 */

import { describe, expect, it } from "vitest";
import type { FunnelFlow, IdeasSeries, ReportResult } from "../../report/types";
import { resolveInformeSources } from "../informeResolver";
import { makePortada } from "./fixtures";

const LIVE_FUNNEL: FunnelFlow = {
  totalIdeas: 50,
  byStatus: { discovered: 20, recommended: 3, "in-pipeline": 5, shipped: 2, discarded: 20 },
  launched: 2,
  conversionPct: 4,
  wip: 3,
  discardsWithoutReason: 1,
};

const LIVE_IDEAS: IdeasSeries = {
  ideasCaptured: [{ isoWeek: "2026-40", count: 9 }],
  ideasWithoutCreated: 4,
};

/** Live readers whose values deliberately differ from the portada fixture's (412 commits, etc.). */
function liveReaders(ideas: ReportResult<IdeasSeries> = { ok: true, value: LIVE_IDEAS }) {
  return {
    weeklyFlow: (): never => {
      throw new Error("the full live weekly flow must not run when the portada is fresh");
    },
    ideasSeries: () => ideas,
    phaseTransitions: () => ({ ok: true as const, value: [] }),
    scalars: () => ({ frds: 99, commits: 1101, decisions: 1, projects: 1, testsPassing: null }),
    lessons: () => null,
    funnel: () => LIVE_FUNNEL,
  };
}

describe("resolveInformeSources: a fresh portada never serves unsealed facts", () => {
  it("commits come from the live reader, not the sealed copy", () => {
    const sources = resolveInformeSources({ ok: true, value: makePortada() }, liveReaders());
    expect(sources.scalars.commits).toBe(1101);
  });

  it("the funnel comes from the live reader", () => {
    const sources = resolveInformeSources({ ok: true, value: makePortada() }, liveReaders());
    expect(sources.funnel).toEqual(LIVE_FUNNEL);
  });

  it("the ideas-per-week series is live while the WO-verified series stays sealed", () => {
    const portada = makePortada();
    const sources = resolveInformeSources({ ok: true, value: portada }, liveReaders());
    expect(sources.weeklyFlow).toEqual({
      ok: true,
      value: {
        woVerified: portada.woFlow.woVerified,
        peakWeek: portada.woFlow.peakWeek,
        ideasCaptured: LIVE_IDEAS.ideasCaptured,
        ideasWithoutCreated: LIVE_IDEAS.ideasWithoutCreated,
      },
    });
  });

  it("the FRD count is still served from the sealed portada", () => {
    const portada = makePortada();
    const sources = resolveInformeSources({ ok: true, value: portada }, liveReaders());
    expect(sources.scalars.frds).toBe(portada.scalars.frds);
  });

  it("an un-derivable live ideas series fails loud instead of a fabricated empty series", () => {
    const sources = resolveInformeSources(
      { ok: true, value: makePortada() },
      liveReaders({ ok: false, reason: "unparseable" }),
    );
    expect(sources.weeklyFlow).toEqual({ ok: false, reason: "unparseable" });
  });
});
