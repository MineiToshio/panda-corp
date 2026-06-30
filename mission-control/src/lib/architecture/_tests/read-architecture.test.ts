/**
 * read-architecture.ts — reader tests. A missing digest is the deliberate "absent" state
 * (→ null → the Arquitectura tab is hidden), NOT a crash (DR-078 fail-loud boundary).
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readArchitectureDigest } from "../read-architecture";

const dirs: string[] = [];
function tmpProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "arch-reader-"));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

function writeDigest(project: string, body: string): void {
  mkdirSync(join(project, ".pandacorp", "comms"), { recursive: true });
  writeFileSync(join(project, ".pandacorp", "comms", "arquitectura-resumen.md"), body);
}

describe("readArchitectureDigest", () => {
  it("returns null when the project has no architecture digest (absent ≠ crash)", () => {
    expect(readArchitectureDigest(tmpProject())).toBeNull();
  });

  it("returns the raw digest when present", () => {
    const project = tmpProject();
    writeDigest(project, "## 🧱 Stack & tecnologías\n");
    expect(readArchitectureDigest(project)).toContain("Stack");
  });

  it("returns null for an empty digest file", () => {
    const project = tmpProject();
    writeDigest(project, "   \n");
    expect(readArchitectureDigest(project)).toBeNull();
  });
});
