/**
 * state-version-moved — shared machine-state-version movement detector.
 *
 * Lifted out of PartyLiveShell so both it and WoLiveRefresh share ONE impl.
 * Pins the baseline-first contract and the strict "> last seen" movement rule.
 */

import { describe, expect, it } from "vitest";

import { stateVersionMoved } from "../state-version-moved";

describe("stateVersionMoved", () => {
  it("returns false when stateVersion is undefined (no signal)", () => {
    const ref = { current: null as number | null };
    expect(stateVersionMoved(undefined, ref)).toBe(false);
    expect(ref.current).toBeNull();
  });

  it("the FIRST observed version only sets the baseline (not movement)", () => {
    const ref = { current: null as number | null };
    expect(stateVersionMoved(1000, ref)).toBe(false);
    expect(ref.current).toBe(1000);
  });

  it("a strictly-greater version counts as movement and advances the ref", () => {
    const ref = { current: 1000 as number | null };
    expect(stateVersionMoved(1500, ref)).toBe(true);
    expect(ref.current).toBe(1500);
  });

  it("an equal or lower version is NOT movement (and does not lower the ref)", () => {
    const ref = { current: 1500 as number | null };
    expect(stateVersionMoved(1500, ref)).toBe(false);
    expect(stateVersionMoved(1200, ref)).toBe(false);
    expect(ref.current).toBe(1500);
  });

  it("tracks a monotonic sequence: baseline, then each genuine advance", () => {
    const ref = { current: null as number | null };
    expect(stateVersionMoved(10, ref)).toBe(false); // baseline
    expect(stateVersionMoved(10, ref)).toBe(false); // replay
    expect(stateVersionMoved(20, ref)).toBe(true); // advance
    expect(stateVersionMoved(20, ref)).toBe(false); // replay of new value
    expect(stateVersionMoved(30, ref)).toBe(true); // advance
  });
});
