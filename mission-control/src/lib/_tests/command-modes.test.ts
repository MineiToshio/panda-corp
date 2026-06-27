/**
 * command-modes — the shared source for CmdRow's inline mode selects (DR-092).
 *
 * Verifies the implement modes are derived faithfully from the canonical BUILD_MODES
 * catalog and that the flag ⇄ BuildMode mapping round-trips (used for per-project
 * persistence in ModeSelector).
 */

import { describe, expect, it } from "vitest";

import { buildModeFlag, buildModeFromFlag, IMPLEMENT_MODES, SPEC_MODES } from "@/lib/command-modes";
import { BUILD_MODES, DEFAULT_BUILD_MODE } from "@/lib/constants";

describe("command-modes — spec clarification modes", () => {
  it("offers exactly --ask / --auto / --infer", () => {
    expect(SPEC_MODES.map((m) => m.flag)).toEqual(["--ask", "--auto", "--infer"]);
    expect(SPEC_MODES.map((m) => m.label)).toEqual(["ask", "auto", "infer"]);
  });
});

describe("command-modes — implement build modes (derived from BUILD_MODES, DR-092)", () => {
  it("lists every catalog mode EXCEPT the default (balanced = the no-flag option)", () => {
    const ids = BUILD_MODES.filter((m) => m.id !== DEFAULT_BUILD_MODE).map((m) => m.id);
    expect(IMPLEMENT_MODES.map((m) => m.flag)).toEqual(ids);
    // Labels are the Spanish display names.
    expect(IMPLEMENT_MODES.map((m) => m.label)).toEqual(["Pro", "Potente", "Profundo"]);
  });

  it("each mode's flag, appended to /pandacorp:implement, equals its catalog command", () => {
    for (const mode of IMPLEMENT_MODES) {
      const catalog = BUILD_MODES.find((m) => m.id === mode.flag);
      expect(`/pandacorp:implement ${mode.flag}`).toBe(catalog?.command);
    }
  });

  it("every mode carries a non-empty description", () => {
    for (const mode of IMPLEMENT_MODES) {
      expect(mode.hint.trim().length).toBeGreaterThan(0);
    }
  });
});

describe("command-modes — flag ⇄ BuildMode mapping (persistence)", () => {
  it("the default (balanced) carries no flag", () => {
    expect(buildModeFlag("balanced")).toBe("");
  });

  it("non-default modes carry their id as the flag", () => {
    expect(buildModeFlag("powerful")).toBe("powerful");
    expect(buildModeFlag("pro")).toBe("pro");
    expect(buildModeFlag("deep")).toBe("deep");
  });

  it("'' resolves back to the default mode", () => {
    expect(buildModeFromFlag("")).toBe(DEFAULT_BUILD_MODE);
  });

  it("an unknown flag falls back to the default (never throws)", () => {
    expect(buildModeFromFlag("ultra-deep")).toBe(DEFAULT_BUILD_MODE);
  });

  it("round-trips for every catalog mode (flag → mode → flag)", () => {
    for (const mode of BUILD_MODES) {
      expect(buildModeFromFlag(buildModeFlag(mode.id))).toBe(mode.id);
    }
  });
});
