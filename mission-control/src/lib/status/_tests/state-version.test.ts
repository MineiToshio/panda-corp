/**
 * stateVersion — max mtime across a project's machine state (status.yaml + WO
 * frontmatter files). DR-066 fix 3 (change mc-observability-consumer-dr066):
 * the SSE stamps it into frames so state-only advances still signal consumers.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";

import { stateVersion } from "../state-version";

// The factory-full unit fixture ships a real project shape: status.yaml + FRD WOs.
const PROJ_A = path.resolve("src/tests/fixtures/factory-full/projects/proj-a");

describe("stateVersion", () => {
  it("returns a finite epoch-ms number for a real project shape", () => {
    const v = stateVersion(PROJ_A);
    expect(typeof v).toBe("number");
    expect(Number.isFinite(v)).toBe(true);
    expect(v as number).toBeGreaterThan(0);
  });

  it("is stable across calls when nothing changed (same inputs → same version)", () => {
    expect(stateVersion(PROJ_A)).toBe(stateVersion(PROJ_A));
  });

  it("missing project → undefined (nothing statable), never a throw", () => {
    expect(stateVersion("/nonexistent/project/root")).toBeUndefined();
  });
});
