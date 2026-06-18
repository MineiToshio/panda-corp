/**
 * WO-01-000 — ADVERSARIAL review tests (written by the reviewer, not the implementer).
 *
 * Goal (DR-015): exercise edge cases, abuse and "are the tolerance fixtures REAL?"
 * questions the implementer's own suite did not cover. A fixture-only WO is worthless
 * if its "malformed" fixtures are not actually malformed to the REAL parsers the
 * downstream readers will use (gray-matter, the `yaml` lib), and if the harness leaks
 * env state. These tests prove the fixtures bite and the harness is honest.
 *
 * Traceability: FRD-01 AC-01-000.1/.2/.3, REQ-01-001..011.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { resolveFactoryRoot } from "@/lib/config/config";
import { FIXTURE_EVENTS_NDJSON, FIXTURE_FRESH, FIXTURE_FULL, withFactoryRoot } from "../index";

// ---------------------------------------------------------------------------
// The tolerance fixtures must be REALLY malformed to the actual parsers.
// (If gray-matter/yaml swallow them, every downstream "graceful skip" test is
//  decorative — it would never exercise the catch branch.)
// ---------------------------------------------------------------------------

describe("adversarial: tolerance fixtures bite the REAL parsers", () => {
  it("frd-01: idea-malformed.md makes gray-matter THROW (not silently parse empty)", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURE_FULL, "factory", "ideas", "idea-malformed.md"),
      "utf-8",
    );
    expect(() => matter(raw)).toThrow();
  });

  it("frd-01: every VALID idea card parses cleanly with gray-matter AND has a status", () => {
    const ideasDir = path.join(FIXTURE_FULL, "factory", "ideas");
    const validCards = fs
      .readdirSync(ideasDir)
      .filter((f) => f.endsWith(".md"))
      .filter((f) => f !== "idea-malformed.md")
      .filter((f) => f !== "_idea-template.md" && f !== "decision-log.md");
    expect(validCards.length).toBeGreaterThanOrEqual(5);
    for (const f of validCards) {
      const raw = fs.readFileSync(path.join(ideasDir, f), "utf-8");
      const parsed = matter(raw);
      const status = (parsed.data as { status?: unknown }).status;
      expect(typeof status, `card ${f} must declare a status`).toBe("string");
    }
  });

  it("frd-01: the five valid cards cover EXACTLY the five lifecycle statuses (no typos)", () => {
    const ideasDir = path.join(FIXTURE_FULL, "factory", "ideas");
    const statuses = fs
      .readdirSync(ideasDir)
      .filter((f) => f.endsWith(".md") && f.startsWith("idea-") && f !== "idea-malformed.md")
      .map((f) => {
        const parsed = matter(fs.readFileSync(path.join(ideasDir, f), "utf-8"));
        return (parsed.data as { status?: string }).status;
      })
      .sort();
    expect(statuses).toEqual(["discarded", "discovered", "in-pipeline", "recommended", "shipped"]);
  });

  it("frd-01: proj-b status.yaml makes the `yaml` lib THROW (real malformed YAML)", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURE_FULL, "projects", "proj-b", ".pandacorp", "status.yaml"),
      "utf-8",
    );
    expect(() => parseYaml(raw)).toThrow();
  });

  it("frd-01: proj-a status.yaml parses cleanly and yields a valid Phase enum", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURE_FULL, "projects", "proj-a", ".pandacorp", "status.yaml"),
      "utf-8",
    );
    const parsed = parseYaml(raw) as Record<string, unknown>;
    expect([
      "product",
      "design",
      "architecture",
      "implementation",
      "release",
      "operation",
    ]).toContain(parsed.phase);
  });

  it("frd-01: the in-pipeline card's project pointer names proj-a and resolves from the factory root", () => {
    const ideaPath = path.join(FIXTURE_FULL, "factory", "ideas", "idea-in-pipeline.md");
    const parsed = matter(fs.readFileSync(ideaPath, "utf-8"));
    const project = (parsed.data as { project?: string }).project;
    expect(typeof project).toBe("string");
    expect(project).toContain("proj-a");
    // The target project dir EXISTS somewhere under the fixture root. We do NOT assert the
    // resolution base here (that contract belongs to the downstream read-ideas WO); we only
    // prove the fixture's pointed-to project actually exists so the reader has a real target.
    // NOTE for downstream: the pointer "../projects/proj-a" does NOT resolve relative to the
    // ideas dir (would be factory/projects/proj-a, which is absent); the real dir is
    // FIXTURE_FULL/projects/proj-a — resolve relative to the FACTORY ROOT, not the card.
    expect(
      fs.existsSync(path.join(FIXTURE_FULL, "projects", "proj-a", ".pandacorp", "status.yaml")),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Events NDJSON: the malformed line must survive a robust line-skip reader,
// and the "no project" lines must be genuinely absent (not project: null/"").
// ---------------------------------------------------------------------------

describe("adversarial: events NDJSON edge cases", () => {
  const lines = (): string[] =>
    fs
      .readFileSync(FIXTURE_EVENTS_NDJSON, "utf-8")
      .split("\n")
      .filter((l) => l.trim().length > 0);

  it("frd-01: exactly one line is unparseable JSON, and skipping it leaves >=10 valid events", () => {
    const all = lines();
    const valid = all.flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });
    expect(all.length - valid.length).toBe(1);
    expect(valid.length).toBeGreaterThanOrEqual(10);
  });

  it("frd-01: 'no project' lines OMIT the key entirely (not project:null / project:'')", () => {
    const valid = lines().flatMap((l) => {
      try {
        return [JSON.parse(l) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
    const noProject = valid.filter((e) => !("project" in e));
    expect(noProject.length).toBeGreaterThan(0);
    // None of them should carry an explicit null/empty project (a different, sneakier case).
    for (const e of valid) {
      if ("project" in e) {
        expect(e.project).not.toBeNull();
        expect(e.project).not.toBe("");
      }
    }
  });

  it("frd-01: the malformed line is in the MIDDLE, not the last line (proves mid-stream tolerance)", () => {
    const all = lines();
    const malformedIdx = all.findIndex((l) => {
      try {
        JSON.parse(l);
        return false;
      } catch {
        return true;
      }
    });
    expect(malformedIdx).toBeGreaterThan(0);
    expect(malformedIdx).toBeLessThan(all.length - 1);
  });
});

// ---------------------------------------------------------------------------
// resolveFactoryRoot edge cases the implementer's suite skipped.
// ---------------------------------------------------------------------------

describe("adversarial: resolveFactoryRoot input hardening", () => {
  it("frd-01: whitespace-only env is treated as unset (falls back to cwd/..)", () => {
    expect(resolveFactoryRoot("   ", "/a/b/c")).toBe(path.resolve("/a/b/c", ".."));
  });

  it("frd-01: empty-string env falls back to cwd/..", () => {
    expect(resolveFactoryRoot("", "/a/b/c")).toBe(path.resolve("/a/b/c", ".."));
  });

  it("frd-01: a relative env path is normalised to an absolute path", () => {
    const r = resolveFactoryRoot("some/relative/dir", "/ignored");
    expect(path.isAbsolute(r)).toBe(true);
  });

  it("frd-01: a trailing-slash env path is normalised (no trailing slash)", () => {
    const r = resolveFactoryRoot("/foo/bar/", "/ignored");
    expect(r).toBe("/foo/bar");
  });
});

// ---------------------------------------------------------------------------
// withFactoryRoot harness: state-leak hardening beyond the happy path.
// ---------------------------------------------------------------------------

describe("adversarial: withFactoryRoot state hygiene", () => {
  let snapshot: string | undefined;
  beforeEach(() => {
    snapshot = process.env.PANDACORP_FACTORY_ROOT;
  });
  afterEach(() => {
    if (snapshot === undefined) delete process.env.PANDACORP_FACTORY_ROOT;
    else process.env.PANDACORP_FACTORY_ROOT = snapshot;
  });

  it("frd-01: restores an EMPTY-STRING prior value (not just defined/undefined)", async () => {
    process.env.PANDACORP_FACTORY_ROOT = "";
    await withFactoryRoot(FIXTURE_FULL, () => {
      expect(process.env.PANDACORP_FACTORY_ROOT).toBe(FIXTURE_FULL);
    });
    // The empty string must be restored verbatim — not deleted.
    expect(process.env.PANDACORP_FACTORY_ROOT).toBe("");
    expect("PANDACORP_FACTORY_ROOT" in process.env).toBe(true);
  });

  it("frd-01: returns the callback's resolved value through to the caller", async () => {
    const out = await withFactoryRoot(FIXTURE_FRESH, () => ({ ok: true }));
    expect(out).toEqual({ ok: true });
  });

  it("frd-01: a rejected async callback still restores the prior env", async () => {
    process.env.PANDACORP_FACTORY_ROOT = "/prior/value";
    await expect(
      withFactoryRoot(FIXTURE_FULL, async () => {
        await Promise.resolve();
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(process.env.PANDACORP_FACTORY_ROOT).toBe("/prior/value");
  });
});

// ---------------------------------------------------------------------------
// Determinism: fixtures are STATIC files committed to git (AC-01-000.1).
// No test may mutate them; they must be tracked, not generated.
// ---------------------------------------------------------------------------

describe("adversarial: fixtures are committed & deterministic (AC-01-000.1)", () => {
  it("frd-01: the malformed fixtures are git-tracked (not generated at test time)", () => {
    // If these files are untracked, the 'committed static' contract is broken.
    const probes = [
      "tests/fixtures/factory-full/factory/ideas/idea-malformed.md",
      "tests/fixtures/factory-full/projects/proj-b/.pandacorp/status.yaml",
      "tests/fixtures/events/dashboard-events.ndjson",
    ];
    const repoRoot = path.resolve(FIXTURE_FULL, "..", "..", ".."); // mission-control/
    for (const rel of probes) {
      const out = execFileSync("git", ["ls-files", "--error-unmatch", rel], {
        cwd: repoRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      expect(out.trim()).toBe(rel);
    }
  });

  it("frd-01: FIXTURE_FRESH carries NO profile.md and an EMPTY ideas dir (onboarding gate)", () => {
    expect(fs.existsSync(path.join(FIXTURE_FRESH, "factory", "profile.md"))).toBe(false);
    const ideas = path.join(FIXTURE_FRESH, "factory", "ideas");
    expect(fs.readdirSync(ideas)).toHaveLength(0);
  });
});
