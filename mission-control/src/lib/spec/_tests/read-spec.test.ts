/**
 * read-spec.ts — reader tests. A missing digest is the deliberate "absent" state (→ null → the
 * Spec tab is hidden), NOT a crash (DR-078 fail-loud boundary).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readSpecDigest } from "../read-spec";

const dirs: string[] = [];
function tmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "spec-reader-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe("readSpecDigest", () => {
  it("returns null when the project has no spec digest (absent ≠ crash)", () => {
    expect(readSpecDigest(tmpProject())).toBeNull();
  });

  it("returns the raw digest when present", () => {
    const project = tmpProject();
    mkdirSync(join(project, ".pandacorp", "comms"), { recursive: true });
    writeFileSync(join(project, ".pandacorp", "comms", "spec-resumen.md"), "## 🧩 FRDs\n");
    expect(readSpecDigest(project)).toContain("FRDs");
  });

  it("returns null for an empty digest file", () => {
    const project = tmpProject();
    mkdirSync(join(project, ".pandacorp", "comms"), { recursive: true });
    writeFileSync(join(project, ".pandacorp", "comms", "spec-resumen.md"), "   \n");
    expect(readSpecDigest(project)).toBeNull();
  });
});
