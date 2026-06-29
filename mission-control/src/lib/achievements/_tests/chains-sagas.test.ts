/**
 * WO-10-013 — chains v2: expanded chains grouped into sagas, all real-signal anchored.
 */

import { describe, expect, it } from "vitest";
import { computeChains } from "../achievements";
import { CHAIN_DEFINITIONS, SAGA_ORDER } from "../definitions";
import { computeStats } from "../stats";

const EMPTY = { ideas: [], statuses: [], eventsSnapshot: null };

describe("chains v2 — sagas + new chains", () => {
  it("has 19 chains across all 5 sagas", () => {
    expect(CHAIN_DEFINITIONS).toHaveLength(19);
    const sagas = new Set(CHAIN_DEFINITIONS.map((c) => c.saga));
    for (const s of SAGA_ORDER) expect(sagas.has(s)).toBe(true);
    expect(sagas.size).toBe(5);
  });

  it("includes the v2 chains (builds, gates, reviews, findings, modes, activedays, subagents)", () => {
    const keys = CHAIN_DEFINITIONS.map((c) => c.statKey);
    for (const k of [
      "builds",
      "subagents",
      "gates",
      "reviews",
      "findings",
      "modes",
      "activedays",
    ]) {
      expect(keys).toContain(k);
    }
  });

  it("computeChains carries the saga on every chain state", () => {
    const chains = computeChains(computeStats(EMPTY));
    expect(chains).toHaveLength(19);
    for (const c of chains) {
      expect(SAGA_ORDER).toContain(c.saga);
    }
  });

  it("the new chains light up from real signals (e.g. gates from GateResult PASS)", () => {
    const data = {
      ideas: [],
      statuses: [],
      eventsSnapshot: {
        events: [{ event: "GateResult", at: "2026-06-21T12:00:00Z", verdict: "PASS" }] as never,
        lastEventAt: null,
        byProject: {},
      },
    };
    const gates = computeChains(computeStats(data)).find((c) => c.statKey === "gates");
    expect(gates?.value).toBe(1);
    expect(gates?.currentTierIndex).toBe(0); // crossed threshold 1
  });
});
