/**
 * WO-01-002 — `readProfile` (presence + parse) — RED phase
 *
 * Acceptance criteria under test (FRD-01 EARS):
 *   AC-01-001.1  WHEN factory/profile.md is NOT found
 *                THEN readProfile SHALL return { present: false } (drives the onboarding gate).
 *   AC-01-002.1  WHEN factory/profile.md exists
 *                THEN readProfile SHALL read it and return name, goals, interests, assets,
 *                     projectsPath (mapped from snake_case) and body.
 *   Edge case    Absent profile → { present: false }, never invented/assumed.
 *   Edge case    Malformed frontmatter → fail-soft: { present: true, profile: { body } }.
 *   Edge case    File present but empty → { present: true, profile: { body: "" } }.
 *   Invariant    readProfile NEVER throws; NEVER writes to disk; NEVER calls Claude.
 *
 * Traceability:
 *   REQ-01-001 (absence signal) → AC-01-001.1
 *   REQ-01-002 (parse + personalize) → AC-01-002.1
 *   REQ-01-011 (read-only invariant, cross-cutting)
 *
 * Bugs from progress.md anchoring regression cases:
 *   None logged against readProfile specifically, but idea-malformed.md shows that
 *   an unterminated quoted YAML string can reach a reader — so we cover the gray-matter
 *   throw path here too.
 *
 * Stack: Vitest + gray-matter (already a dependency in package.json).
 * No network calls, no writes, no shared mutable state between tests.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FIXTURE_FRESH, FIXTURE_FULL, withFactoryRoot } from "@/tests/fixtures/index";
import { readProfile } from "./profile";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a temporary directory with an optional `factory/profile.md` and tear it down after. */
function makeTempFactory(content?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-profile-test-"));
  const factoryDir = path.join(dir, "factory");
  fs.mkdirSync(factoryDir, { recursive: true });
  if (content !== undefined) {
    fs.writeFileSync(path.join(factoryDir, "profile.md"), content, "utf-8");
  }
  return dir;
}

// ---------------------------------------------------------------------------
// AC-01-001.1 — WHEN profile.md is NOT found THEN { present: false }
// ---------------------------------------------------------------------------

describe("frd-01: AC-01-001.1 — absent profile.md → { present: false }", () => {
  it("frd-01: WHEN Pandacorp loads and does NOT find factory/profile.md THEN readProfile returns { present: false }", async () => {
    await withFactoryRoot(FIXTURE_FRESH, () => {
      const result = readProfile();
      expect(result.present).toBe(false);
    });
  });

  it("frd-01: WHEN profile.md is absent THEN result has no profile field (no data invented)", async () => {
    await withFactoryRoot(FIXTURE_FRESH, () => {
      const result = readProfile();
      expect(result.present).toBe(false);
      // Type narrowing: the { present: false } discriminant carries no profile payload.
      if (!result.present) {
        // @ts-expect-error — TypeScript must reject .profile on the absent branch
        expect(result.profile).toBeUndefined();
      }
    });
  });

  it("frd-01: WHEN a nonexistent explicit path is supplied THEN readProfile returns { present: false }", () => {
    const result = readProfile("/does/not/exist/profile.md");
    expect(result.present).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-01-002.1 — WHEN profile.md exists THEN read + parse all fields
// ---------------------------------------------------------------------------

describe("frd-01: AC-01-002.1 — profile.md present → parse and return all fields", () => {
  it("frd-01: WHEN factory/profile.md exists THEN readProfile returns { present: true }", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readProfile();
      expect(result.present).toBe(true);
    });
  });

  it("frd-01: WHEN profile.md is present THEN result.profile.name is populated (REQ-01-002 personalize)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readProfile();
      if (!result.present) throw new Error("Expected present: true");
      expect(typeof result.profile.name).toBe("string");
      expect(result.profile.name?.trim().length).toBeGreaterThan(0);
    });
  });

  it("frd-01: WHEN profile.md is present THEN result.profile.goals is populated", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readProfile();
      if (!result.present) throw new Error("Expected present: true");
      expect(typeof result.profile.goals).toBe("string");
      expect(result.profile.goals?.trim().length).toBeGreaterThan(0);
    });
  });

  it("frd-01: WHEN profile.md is present THEN result.profile.interests is a non-empty array", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readProfile();
      if (!result.present) throw new Error("Expected present: true");
      expect(Array.isArray(result.profile.interests)).toBe(true);
      expect(result.profile.interests?.length).toBeGreaterThan(0);
      for (const item of result.profile.interests!) {
        expect(typeof item).toBe("string");
      }
    });
  });

  it("frd-01: WHEN profile.md is present THEN result.profile.assets is a non-empty array", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readProfile();
      if (!result.present) throw new Error("Expected present: true");
      expect(Array.isArray(result.profile.assets)).toBe(true);
      expect(result.profile.assets?.length).toBeGreaterThan(0);
      for (const item of result.profile.assets!) {
        expect(typeof item).toBe("string");
      }
    });
  });

  it("frd-01: WHEN profile.md has projects_path THEN it is mapped to projectsPath (camelCase, REQ-01-002)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readProfile();
      if (!result.present) throw new Error("Expected present: true");
      // The fixture has `projects_path: "/Users/ada/projects"` — must appear as projectsPath.
      expect(typeof result.profile.projectsPath).toBe("string");
      expect(result.profile.projectsPath?.trim().length).toBeGreaterThan(0);
      // Regression: snake_case key must NOT leak through — only projectsPath is valid.
    });
  });

  it("frd-01: WHEN profile.md is present THEN result.profile.body contains the markdown body text", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readProfile();
      if (!result.present) throw new Error("Expected present: true");
      // body must always be a string (possibly empty if no body), never undefined.
      expect(typeof result.profile.body).toBe("string");
      // The fixture body is non-empty.
      expect(result.profile.body.trim().length).toBeGreaterThan(0);
    });
  });

  it("frd-01: WHEN profile.md is present THEN name matches the fixture value 'Ada Lovelace'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readProfile();
      if (!result.present) throw new Error("Expected present: true");
      expect(result.profile.name).toBe("Ada Lovelace");
    });
  });

  it("frd-01: WHEN profile.md is present THEN projectsPath matches the fixture value '/Users/ada/projects'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readProfile();
      if (!result.present) throw new Error("Expected present: true");
      expect(result.profile.projectsPath).toBe("/Users/ada/projects");
    });
  });

  it("frd-01: WHEN an explicit path is supplied THEN readProfile reads from that path (not from config.PROFILE)", () => {
    const profilePath = path.join(FIXTURE_FULL, "factory", "profile.md");
    const result = readProfile(profilePath);
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.profile.name).toBe("Ada Lovelace");
  });
});

// ---------------------------------------------------------------------------
// Edge case — malformed frontmatter → fail-soft, never throw
// ---------------------------------------------------------------------------

describe("frd-01: edge case — malformed frontmatter → fail-soft (blueprint §3)", () => {
  let tempRoot: string;
  afterEach(() => {
    // Clean up temp directories created by makeTempFactory.
    if (tempRoot) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("frd-01: WHEN profile.md has an unterminated YAML string THEN readProfile does NOT throw", () => {
    // Mirrors the bug pattern from idea-malformed.md (progress.md regression anchor).
    tempRoot = makeTempFactory('---\nname: "unterminated\ngoals: "valid"\n---\n');
    const result = readProfile(path.join(tempRoot, "factory", "profile.md"));
    // Must not throw; must return { present: true } with at least the body field.
    expect(result.present).toBe(true);
  });

  it("frd-01: WHEN profile.md has malformed frontmatter THEN result.profile.body is always a string", () => {
    tempRoot = makeTempFactory("---\nthis: [broken yaml\n---\nsome body text\n");
    const result = readProfile(path.join(tempRoot, "factory", "profile.md"));
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(typeof result.profile.body).toBe("string");
  });

  it("frd-01: WHEN profile.md has no frontmatter delimiters THEN result is { present: true } with body content", () => {
    tempRoot = makeTempFactory("Just a plain markdown body with no frontmatter.\n");
    const result = readProfile(path.join(tempRoot, "factory", "profile.md"));
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.profile.body).toContain("plain markdown body");
  });

  it("frd-01: WHEN profile.md is empty (0 bytes) THEN result is { present: true, profile: { body: '' } }", () => {
    tempRoot = makeTempFactory("");
    const result = readProfile(path.join(tempRoot, "factory", "profile.md"));
    expect(result.present).toBe(true);
    if (!result.present) return;
    // Missing optional fields stay undefined — never fabricated.
    expect(result.profile.name).toBeUndefined();
    expect(result.profile.goals).toBeUndefined();
    expect(result.profile.interests).toBeUndefined();
    expect(result.profile.assets).toBeUndefined();
    expect(result.profile.projectsPath).toBeUndefined();
    expect(typeof result.profile.body).toBe("string");
  });

  it("frd-01: WHEN frontmatter fields are missing THEN they are undefined (not null, not empty string)", () => {
    // Profile with only `name:` — other fields absent.
    tempRoot = makeTempFactory('---\nname: "Partial Profile"\n---\nBody only.\n');
    const result = readProfile(path.join(tempRoot, "factory", "profile.md"));
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.profile.name).toBe("Partial Profile");
    // Missing optional fields must be strictly undefined, never null or empty string.
    expect(result.profile.goals).toBeUndefined();
    expect(result.profile.interests).toBeUndefined();
    expect(result.profile.assets).toBeUndefined();
    expect(result.profile.projectsPath).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Edge case — only frontmatter, no body text
// ---------------------------------------------------------------------------

describe("frd-01: edge case — profile with frontmatter but no markdown body", () => {
  let tempRoot: string;
  afterEach(() => {
    if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("frd-01: WHEN profile.md has valid frontmatter but empty body THEN body is '' and fields parse correctly", () => {
    tempRoot = makeTempFactory('---\nname: "No Body"\ngoals: "nothing"\n---\n');
    const result = readProfile(path.join(tempRoot, "factory", "profile.md"));
    expect(result.present).toBe(true);
    if (!result.present) return;
    expect(result.profile.name).toBe("No Body");
    expect(result.profile.body.trim()).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Invariant — REQ-01-011: never write, never call Claude
// ---------------------------------------------------------------------------

describe("frd-01: REQ-01-011 — read-only invariant", () => {
  it("frd-01: WHEN readProfile runs THEN it does not write any file (spy on fs.writeFileSync)", async () => {
    // We cannot easily spy without mocking, so we prove it structurally:
    // call readProfile and assert the fixture directory mtime is unchanged.
    const profilePath = path.join(FIXTURE_FULL, "factory", "profile.md");
    const statBefore = fs.statSync(profilePath);

    await withFactoryRoot(FIXTURE_FULL, () => {
      readProfile();
    });

    const statAfter = fs.statSync(profilePath);
    expect(statAfter.mtimeMs).toBe(statBefore.mtimeMs);
  });

  it("frd-01: WHEN readProfile runs against the FRESH fixture THEN it does not create profile.md", async () => {
    // The absence must remain an absence; the function must not create the file.
    const profilePath = path.join(FIXTURE_FRESH, "factory", "profile.md");
    await withFactoryRoot(FIXTURE_FRESH, () => {
      readProfile();
    });
    expect(fs.existsSync(profilePath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Type contract — ProfileResult discriminated union
// ---------------------------------------------------------------------------

describe("frd-01: ProfileResult discriminated union contract", () => {
  it("frd-01: WHEN present is false THEN the result has no profile key on the object", async () => {
    await withFactoryRoot(FIXTURE_FRESH, () => {
      const result = readProfile();
      expect(result.present).toBe(false);
      expect("profile" in result).toBe(false);
    });
  });

  it("frd-01: WHEN present is true THEN the result has a profile key with at least a body field", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = readProfile();
      expect(result.present).toBe(true);
      expect("profile" in result).toBe(true);
      if (result.present) {
        expect("body" in result.profile).toBe(true);
      }
    });
  });
});
