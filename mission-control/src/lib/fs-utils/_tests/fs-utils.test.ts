/**
 * WO-01-001 — `pathExists` read-only probe (RED phase)
 *
 * Traceability:
 *   FRD-01 AC-01-010.1 — IF a project's path does not exist, THEN the system SHALL mark it as
 *   not found and SHALL NOT break the rest of the view.
 *   REQ-01-010 → IF-01-pathExists → `lib/fs-utils.ts`
 *
 * Contract under test:
 *   export function pathExists(p: string): boolean;
 *   // never throws; returns false on absent path or on any error
 *
 * Tests are RED until `lib/fs-utils.ts` is implemented (WO-01-001 GREEN phase).
 * All imports are intentional — the import will fail with a module-not-found error until
 * the implementation file exists, which is the expected RED state.
 *
 * Past incidents that drive regression tests:
 *   - B1' (progress.md @ 2026-06-16): `typeof NaN === "number"` silently passing type guards.
 *     Analogous risk here: unusual path values (empty string, NaN-derived strings, objects
 *     coerced to string) must never cause pathExists to throw.
 *   - I2 (progress.md @ 2026-06-16): vacuous-truth in empty-collection guards.
 *     Analogous: an empty string path must return false, never vacuously true.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_FRESH, FIXTURE_FULL } from "@/tests/fixtures";

// ---------------------------------------------------------------------------
// The module under test — does not exist yet (RED phase).
// ---------------------------------------------------------------------------
import { pathExists } from "../fs-utils";

// ---------------------------------------------------------------------------
// AC-01-010.1 — WHEN a path exists THEN pathExists returns true
// ---------------------------------------------------------------------------

describe("frd-01: AC-01-010.1 — pathExists returns true for existing paths", () => {
  it("frd-01: WHEN given the FIXTURE_FULL root dir THEN returns true", () => {
    expect(pathExists(FIXTURE_FULL)).toBe(true);
  });

  it("frd-01: WHEN given FIXTURE_FRESH root dir THEN returns true", () => {
    expect(pathExists(FIXTURE_FRESH)).toBe(true);
  });

  it("frd-01: WHEN given a known fixture file (profile.md) THEN returns true", () => {
    const p = path.join(FIXTURE_FULL, "factory", "profile.md");
    expect(pathExists(p)).toBe(true);
  });

  it("frd-01: WHEN given a known fixture subdirectory THEN returns true", () => {
    const p = path.join(FIXTURE_FULL, "factory", "ideas");
    expect(pathExists(p)).toBe(true);
  });

  it("frd-01: WHEN given an existing file in a project fixture THEN returns true", () => {
    const p = path.join(FIXTURE_FULL, "projects", "proj-a", ".pandacorp", "status.yaml");
    expect(pathExists(p)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC-01-010.1 — WHEN a path does not exist THEN pathExists returns false and does NOT throw
// ---------------------------------------------------------------------------

describe("frd-01: AC-01-010.1 — pathExists returns false for absent paths", () => {
  it("frd-01: WHEN given a completely nonexistent path THEN returns false", () => {
    expect(pathExists("/nonexistent/path/does/not/exist/ever")).toBe(false);
  });

  it("frd-01: WHEN given a nonexistent file inside an existing dir THEN returns false", () => {
    const p = path.join(FIXTURE_FULL, "factory", "profile-does-not-exist.md");
    expect(pathExists(p)).toBe(false);
  });

  it("frd-01: WHEN given a path matching the portfolio broken-path fixture THEN returns false", () => {
    // The portfolio fixture contains a row pointing to /nonexistent/path/does/not/exist
    // This is the exact REQ-01-010 scenario: mark not-found without breaking the view.
    expect(pathExists("/nonexistent/path/does/not/exist")).toBe(false);
  });

  it("frd-01: WHEN given an absent project path THEN returns false without throwing (REQ-01-010)", () => {
    const absentProject = path.join(FIXTURE_FULL, "projects", "proj-ghost");
    expect(() => pathExists(absentProject)).not.toThrow();
    expect(pathExists(absentProject)).toBe(false);
  });

  it("frd-01: WHEN given a path to a nonexistent YAML status THEN returns false (readStatus tolerance)", () => {
    const p = path.join(FIXTURE_FULL, "projects", "proj-ghost", ".pandacorp", "status.yaml");
    expect(pathExists(p)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-01-010.1 — SHALL NOT throw — error path / permission errors
// ---------------------------------------------------------------------------

describe("frd-01: AC-01-010.1 — pathExists NEVER throws on error paths", () => {
  it("frd-01: WHEN given an empty string THEN returns false without throwing", () => {
    expect(() => pathExists("")).not.toThrow();
    expect(pathExists("")).toBe(false);
  });

  it("frd-01: WHEN given a path with only whitespace THEN returns false without throwing", () => {
    // Regression: empty/blank inputs must not leak to existsSync and cause surprises.
    expect(() => pathExists("   ")).not.toThrow();
    expect(pathExists("   ")).toBe(false);
  });

  it("frd-01: WHEN given a path with null bytes THEN returns false without throwing", () => {
    // null bytes in paths cause ENOENT/EINVAL on Linux/macOS — must be swallowed.
    expect(() => pathExists("/tmp/nul\0byte")).not.toThrow();
    expect(pathExists("/tmp/nul\0byte")).toBe(false);
  });

  it("frd-01: WHEN existsSync is mocked to throw THEN pathExists returns false without re-throwing", async () => {
    // Simulates a permission error or unexpected fs failure (e.g., EPERM, EACCES).
    // We replace fs.existsSync temporarily.
    const original = fs.existsSync;
    // biome-ignore lint/suspicious/noExplicitAny: intentional monkey-patch for error-path test
    (fs as any).existsSync = () => {
      throw new Error("EPERM: operation not permitted");
    };
    try {
      expect(() => pathExists("/any/path")).not.toThrow();
      expect(pathExists("/any/path")).toBe(false);
    } finally {
      // biome-ignore lint/suspicious/noExplicitAny: restoring the original
      (fs as any).existsSync = original;
    }
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant — SHALL NEVER write
// ---------------------------------------------------------------------------

describe("frd-01: pathExists is strictly read-only (REQ-01-011)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-pathexists-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("frd-01: WHEN called on an existing dir THEN no files are created or modified inside it", () => {
    const before = fs.readdirSync(tmpDir);
    const beforeMtime = fs.statSync(tmpDir).mtimeMs;
    pathExists(tmpDir);
    const after = fs.readdirSync(tmpDir);
    const afterMtime = fs.statSync(tmpDir).mtimeMs;
    expect(after).toEqual(before);
    expect(afterMtime).toBe(beforeMtime);
  });

  it("frd-01: WHEN called on a nonexistent path THEN it does not CREATE that path", () => {
    const ghost = path.join(tmpDir, "ghost-project");
    pathExists(ghost);
    expect(fs.existsSync(ghost)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Idempotency — multiple calls must return consistent results
// ---------------------------------------------------------------------------

describe("frd-01: pathExists is idempotent and order-independent", () => {
  it("frd-01: repeated calls on the same existing path always return true", () => {
    const p = path.join(FIXTURE_FULL, "factory", "profile.md");
    expect(pathExists(p)).toBe(true);
    expect(pathExists(p)).toBe(true);
    expect(pathExists(p)).toBe(true);
  });

  it("frd-01: repeated calls on the same nonexistent path always return false", () => {
    const p = "/definitely/does/not/exist/on/any/machine/abc123";
    expect(pathExists(p)).toBe(false);
    expect(pathExists(p)).toBe(false);
    expect(pathExists(p)).toBe(false);
  });

  it("frd-01: interleaved calls on existing and absent paths return independent results", () => {
    const exists = path.join(FIXTURE_FULL, "factory", "portfolio.md");
    const absent = "/nonexistent/path/does/not/exist/abc";
    expect(pathExists(exists)).toBe(true);
    expect(pathExists(absent)).toBe(false);
    expect(pathExists(exists)).toBe(true);
    expect(pathExists(absent)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Return type — must be a strict boolean (not truthy/falsy)
// Regression for B1'-style bugs where typeof checks pass unexpected values.
// ---------------------------------------------------------------------------

describe("frd-01: pathExists return type is strict boolean (regression B1' pattern)", () => {
  it("frd-01: return value for an existing path is exactly true (not just truthy)", () => {
    const result = pathExists(FIXTURE_FULL);
    expect(result).toBe(true);
    expect(typeof result).toBe("boolean");
  });

  it("frd-01: return value for a nonexistent path is exactly false (not null/undefined/0)", () => {
    const result = pathExists("/nonexistent/definitely/absent");
    expect(result).toBe(false);
    expect(typeof result).toBe("boolean");
  });

  it("frd-01: return value on error is exactly false (not null/undefined/thrown)", () => {
    // empty string triggers fs.existsSync edge behaviour on some runtimes
    const result = pathExists("");
    expect(result).toBe(false);
    expect(typeof result).toBe("boolean");
  });
});
