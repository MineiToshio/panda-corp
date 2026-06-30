/**
 * RED → GREEN tests for IF-10-scalars (`reportScalars` / `deriveScalars`), WO-10-014, AC-10-014.3.
 *
 * The pure `deriveScalars` is driven with injected source counts (so the assertion is stable
 * across drift); tests-passing is a real count OR an explicit null — never a fabricated number.
 */

import { describe, expect, it } from "vitest";
import { deriveScalars } from "../scalars";

describe("deriveScalars — wired counts", () => {
  it("passes through the wired source counts", () => {
    const s = deriveScalars({
      frds: 21,
      commits: 823,
      decisions: 99,
      projects: 2,
      testsPassing: 7134,
    });
    expect(s).toEqual({ frds: 21, commits: 823, decisions: 99, projects: 2, testsPassing: 7134 });
  });

  it("tests-passing absent → testsPassing is null (no cableado), never a fabricated number", () => {
    const s = deriveScalars({
      frds: 21,
      commits: 823,
      decisions: 99,
      projects: 2,
      testsPassing: null,
    });
    expect(s.testsPassing).toBeNull();
  });

  it("a commits count of 0 (git returned nothing) is preserved as a real 0, distinct from null", () => {
    const s = deriveScalars({
      frds: 0,
      commits: 0,
      decisions: 0,
      projects: 0,
      testsPassing: null,
    });
    expect(s.commits).toBe(0);
    expect(s.testsPassing).toBeNull();
  });
});
