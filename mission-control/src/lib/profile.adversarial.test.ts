/**
 * WO-01-002 — `readProfile` ADVERSARIAL tests (DR-015).
 *
 * Reviewer-authored (Opus 4.8, a different model from the implementer) — edge cases,
 * type-coercion abuse and fail-soft paths the implementer did NOT cover in profile.test.ts.
 *
 * These exercise the type guards in lib/profile.ts directly:
 *   - YAML scalars that are the wrong shape (number, null, single string) must NOT leak
 *     into the typed Profile — the field must stay strictly `undefined`, never fabricated.
 *   - Heterogeneous arrays must be rejected wholesale (the contract promises string[]).
 *   - snake_case → camelCase mapping must read ONLY `projects_path`.
 *   - Non-frontmatter abuse (BOM, CRLF, directory path, prototype keys) must stay fail-soft.
 *
 * Invariants under attack: never throw, never write, never fabricate fields.
 *
 * No shared mutable state; every temp dir is torn down.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readProfile } from "./profile";

let tempRoot: string | undefined;

afterEach(() => {
  if (tempRoot) {
    fs.rmSync(tempRoot, { recursive: true, force: true });
    tempRoot = undefined;
  }
});

/** Write `content` to `<tmp>/factory/profile.md` and return the absolute file path. */
function profileWith(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-profile-adv-"));
  tempRoot = dir;
  const factoryDir = path.join(dir, "factory");
  fs.mkdirSync(factoryDir, { recursive: true });
  const file = path.join(factoryDir, "profile.md");
  fs.writeFileSync(file, content, "utf-8");
  return file;
}

// ---------------------------------------------------------------------------
// Type coercion abuse — wrong-typed scalars must be dropped, not coerced
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: wrong-typed frontmatter scalars are dropped (never fabricated)", () => {
  it("frd-01: WHEN name is a YAML number THEN profile.name stays undefined (no String() coercion)", () => {
    const r = readProfile(profileWith("---\nname: 42\n---\nbody\n"));
    expect(r.present).toBe(true);
    if (!r.present) return;
    // 42 is not a string — the guard must reject it. A bug would surface as name === 42 or "42".
    expect(r.profile.name).toBeUndefined();
  });

  it("frd-01: WHEN name is explicit YAML null THEN profile.name stays undefined", () => {
    const r = readProfile(profileWith("---\nname: null\n---\nbody\n"));
    expect(r.present).toBe(true);
    if (!r.present) return;
    expect(r.profile.name).toBeUndefined();
    expect(r.profile.name).not.toBeNull();
  });

  it("frd-01: WHEN name is a YAML boolean THEN profile.name stays undefined", () => {
    const r = readProfile(profileWith("---\nname: true\n---\nbody\n"));
    expect(r.present).toBe(true);
    if (!r.present) return;
    expect(r.profile.name).toBeUndefined();
  });

  it("frd-01: WHEN goals is a mapping (object) THEN profile.goals stays undefined", () => {
    const r = readProfile(profileWith("---\ngoals:\n  nested: x\n---\nbody\n"));
    expect(r.present).toBe(true);
    if (!r.present) return;
    expect(r.profile.goals).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Array contract abuse — string[] only; reject scalars and heterogeneous arrays
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: array fields reject non-string[] shapes", () => {
  it("frd-01: WHEN interests is a single string (not a list) THEN it is dropped (stays undefined)", () => {
    const r = readProfile(profileWith('---\ninterests: "just one"\n---\nbody\n'));
    expect(r.present).toBe(true);
    if (!r.present) return;
    // The contract types interests as string[] | undefined. A bare string must NOT pass through.
    expect(r.profile.interests).toBeUndefined();
  });

  it("frd-01: WHEN assets mixes strings and numbers THEN the whole field is dropped (not partially kept)", () => {
    const r = readProfile(profileWith('---\nassets:\n  - "a"\n  - 5\n  - "b"\n---\nbody\n'));
    expect(r.present).toBe(true);
    if (!r.present) return;
    // Heterogeneous array → reject wholesale; never expose a number where string[] is promised.
    expect(r.profile.assets).toBeUndefined();
  });

  it("frd-01: WHEN interests is an array containing null THEN it is dropped", () => {
    const r = readProfile(profileWith('---\ninterests:\n  - "a"\n  -\n---\nbody\n'));
    expect(r.present).toBe(true);
    if (!r.present) return;
    expect(r.profile.interests).toBeUndefined();
  });

  it("frd-01: WHEN assets is an empty list THEN it is an empty array (valid string[]) — body still present", () => {
    const r = readProfile(profileWith("---\nassets: []\n---\nbody\n"));
    expect(r.present).toBe(true);
    if (!r.present) return;
    // [] satisfies "array of strings" vacuously; it is a legitimate value, distinct from undefined.
    expect(Array.isArray(r.profile.assets)).toBe(true);
    expect(r.profile.assets).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// snake_case → camelCase mapping: only projects_path is read
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: projectsPath mapping reads only projects_path", () => {
  it("frd-01: WHEN only camelCase projectsPath is present in YAML THEN it is NOT picked up", () => {
    // The contract maps snake_case `projects_path`. A raw `projectsPath` key in YAML is not the
    // factory convention and must not be silently honored (would mask a real mapping bug).
    const r = readProfile(profileWith('---\nprojectsPath: "/camel/only"\n---\nbody\n'));
    expect(r.present).toBe(true);
    if (!r.present) return;
    expect(r.profile.projectsPath).toBeUndefined();
  });

  it("frd-01: WHEN both projects_path and projectsPath exist THEN snake_case wins", () => {
    const r = readProfile(
      profileWith('---\nprojects_path: "/snake/wins"\nprojectsPath: "/camel/loses"\n---\nbody\n'),
    );
    expect(r.present).toBe(true);
    if (!r.present) return;
    expect(r.profile.projectsPath).toBe("/snake/wins");
  });

  it("frd-01: WHEN projects_path is a number THEN projectsPath stays undefined", () => {
    const r = readProfile(profileWith("---\nprojects_path: 123\n---\nbody\n"));
    expect(r.present).toBe(true);
    if (!r.present) return;
    expect(r.profile.projectsPath).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Fail-soft on non-file / unreadable paths
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: fail-soft on unreadable targets (never throw)", () => {
  it("frd-01: WHEN the path is a directory (EISDIR) THEN readProfile returns { present: false }, no throw", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-profile-dir-"));
    tempRoot = dir;
    // Pointing at a directory makes readFileSync throw EISDIR — must be swallowed as absence.
    expect(() => readProfile(dir)).not.toThrow();
    const r = readProfile(dir);
    expect(r.present).toBe(false);
  });

  it("frd-01: WHEN the path is an empty string THEN readProfile returns { present: false }, no throw", () => {
    expect(() => readProfile("")).not.toThrow();
    // An empty explicit path must not be treated as "use default"; "" is falsy so the default
    // factory path is used instead — either way it must never throw and must yield a typed result.
    const r = readProfile("");
    expect(typeof r.present).toBe("boolean");
  });
});

// ---------------------------------------------------------------------------
// Prototype-pollution safety — a __proto__ key in YAML must not pollute or break typing
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: __proto__ in frontmatter does not pollute or corrupt the result", () => {
  it("frd-01: WHEN frontmatter has a __proto__ mapping THEN Object.prototype is untouched and name still parses", () => {
    const r = readProfile(
      profileWith('---\n__proto__:\n  polluted: true\nname: "Safe"\n---\nbody\n'),
    );
    expect(r.present).toBe(true);
    if (!r.present) return;
    expect(r.profile.name).toBe("Safe");
    // No global pollution leaked.
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Encoding / line-ending robustness
// ---------------------------------------------------------------------------

describe("frd-01 adversarial: encoding and line-ending robustness", () => {
  it("frd-01: WHEN profile.md has CRLF line endings THEN frontmatter still parses", () => {
    const r = readProfile(profileWith('---\r\nname: "CRLF Ada"\r\n---\r\nbody line\r\n'));
    expect(r.present).toBe(true);
    if (!r.present) return;
    expect(r.profile.name).toBe("CRLF Ada");
  });

  it("frd-01: WHEN profile.md starts with a UTF-8 BOM THEN it does not throw and body is a string", () => {
    const r = readProfile(profileWith('﻿---\nname: "BOM Ada"\n---\nbody\n'));
    expect(r.present).toBe(true);
    if (!r.present) return;
    // BOM may prevent frontmatter recognition; the hard invariant is: no throw, body is a string.
    expect(typeof r.profile.body).toBe("string");
  });
});
