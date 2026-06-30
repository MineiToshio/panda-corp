/**
 * RED → GREEN tests for IF-10-phase-transitions (`phaseTransitions`), WO-10-014, AC-10-014.2 / .7.
 *
 * Drives the pure `derivePhaseTransitions` with a real-shape per-project phase history
 * (mission-control's 4 transitions incl. the 06-19 reopen) + malformed/absent inputs.
 */

import { describe, expect, it } from "vitest";
import { derivePhaseTransitions } from "../phaseTransitions";

describe("derivePhaseTransitions — real shape (mission-control)", () => {
  it("emits one transition per phase change with isReopen on a backward move", () => {
    // Chronological phase observations for mission-control (oldest → newest), each {date, phase}.
    const history = {
      "mission-control": [
        { date: "2026-06-14", phase: "architecture" },
        { date: "2026-06-16", phase: "implementation" },
        { date: "2026-06-18", phase: "release" },
        { date: "2026-06-19", phase: "implementation" }, // reopen (release → implementation)
        { date: "2026-06-21", phase: "release" },
      ],
    };

    const result = derivePhaseTransitions(history);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t = result.value;

    expect(t).toEqual([
      {
        project: "mission-control",
        date: "2026-06-16",
        from: "architecture",
        to: "implementation",
        isReopen: false,
      },
      {
        project: "mission-control",
        date: "2026-06-18",
        from: "implementation",
        to: "release",
        isReopen: false,
      },
      {
        project: "mission-control",
        date: "2026-06-19",
        from: "release",
        to: "implementation",
        isReopen: true,
      },
      {
        project: "mission-control",
        date: "2026-06-21",
        from: "implementation",
        to: "release",
        isReopen: false,
      },
    ]);
  });

  it("a project that never advanced (single observation) yields zero transitions, not an error", () => {
    const result = derivePhaseTransitions({
      "proj-a": [{ date: "2026-06-10", phase: "product" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });
});

describe("derivePhaseTransitions — fail-loud (DR-078)", () => {
  it("git unavailable (null) → explicit absent", () => {
    const result = derivePhaseTransitions(null);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("git-unavailable");
  });

  it("an unrecognised phase value → unparseable, never silently dropped", () => {
    const result = derivePhaseTransitions({
      "proj-a": [
        { date: "2026-06-10", phase: "product" },
        { date: "2026-06-11", phase: "frobnicate" },
      ],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("unparseable");
  });

  it("an empty history is a legitimate zero (ok:true, [])", () => {
    const result = derivePhaseTransitions({});
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
  });
});
