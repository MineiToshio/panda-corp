/**
 * WO-01-000 — Test fixtures + PANDACORP_FACTORY_ROOT harness
 *
 * These tests prove:
 *   AC-01-000.1  The fixture trees exist and are committed as static files.
 *   AC-01-000.2  `withFactoryRoot(FIXTURE_FULL, fn)` makes resolveFactoryRoot() resolve
 *                to the fixture, restoring the prior env afterward.
 *   AC-01-000.3  The fixtures include every tolerance case (malformed card, malformed yaml,
 *                missing repo, broken path, missing profile, empty ideas, malformed event line).
 *
 * Traceability: FRD-01 EARS criteria → REQ-01-001 .. REQ-01-011.
 *
 * NOTE (RED phase): these tests compile and run against the already-shipped `lib/config.ts`
 * (`resolveFactoryRoot`). All other reader modules are NOT yet implemented — their tests live
 * in their own WO test files and are intentionally RED until those WOs land.
 */

import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveFactoryRoot } from "@/lib/config/config";
import {
  FIXTURE_EVENTS_DIR,
  FIXTURE_EVENTS_EMPTY_NDJSON,
  FIXTURE_EVENTS_NDJSON,
  FIXTURE_FRESH,
  FIXTURE_FULL,
  FIXTURES_DIR,
  withFactoryRoot,
} from "../index";

// ---------------------------------------------------------------------------
// AC-01-000.1 — fixture trees exist on disk
// ---------------------------------------------------------------------------

describe("frd-01 fixtures: AC-01-000.1 — tree existence", () => {
  it("frd-01: FIXTURE_FULL root exists", () => {
    expect(fs.existsSync(FIXTURE_FULL)).toBe(true);
    expect(fs.statSync(FIXTURE_FULL).isDirectory()).toBe(true);
  });

  it("frd-01: FIXTURE_FRESH root exists", () => {
    expect(fs.existsSync(FIXTURE_FRESH)).toBe(true);
    expect(fs.statSync(FIXTURE_FRESH).isDirectory()).toBe(true);
  });

  it("frd-01: FIXTURE_EVENTS_DIR exists", () => {
    expect(fs.existsSync(FIXTURE_EVENTS_DIR)).toBe(true);
  });

  // REQ-01-002 — profile.md present in FULL fixture
  it("frd-01: FIXTURE_FULL has factory/profile.md (personalized factory)", () => {
    const p = path.join(FIXTURE_FULL, "factory", "profile.md");
    expect(fs.existsSync(p)).toBe(true);
  });

  // REQ-01-001 — profile.md ABSENT in FRESH fixture (onboarding gate case)
  it("frd-01: FIXTURE_FRESH has NO factory/profile.md (onboarding gate)", () => {
    const p = path.join(FIXTURE_FRESH, "factory", "profile.md");
    expect(fs.existsSync(p)).toBe(false);
  });

  // REQ-01-003 — ideas folder
  it("frd-01: FIXTURE_FULL has factory/ideas/ directory", () => {
    const dir = path.join(FIXTURE_FULL, "factory", "ideas");
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.statSync(dir).isDirectory()).toBe(true);
  });

  // REQ-01-003 edge case — empty ideas in FRESH
  it("frd-01: FIXTURE_FRESH ideas folder is empty", () => {
    const dir = path.join(FIXTURE_FRESH, "factory", "ideas");
    expect(fs.existsSync(dir)).toBe(true);
    const entries = fs.readdirSync(dir);
    expect(entries).toHaveLength(0);
  });

  // REQ-01-004 — portfolio
  it("frd-01: FIXTURE_FULL has factory/portfolio.md", () => {
    const p = path.join(FIXTURE_FULL, "factory", "portfolio.md");
    expect(fs.existsSync(p)).toBe(true);
  });

  // REQ-01-005 — complete status.yaml for proj-a
  it("frd-01: proj-a has .pandacorp/status.yaml", () => {
    const p = path.join(FIXTURE_FULL, "projects", "proj-a", ".pandacorp", "status.yaml");
    expect(fs.existsSync(p)).toBe(true);
  });

  // REQ-01-007 — feature-centric docs tree
  it("frd-01: proj-a has docs/product/prd.md", () => {
    expect(
      fs.existsSync(path.join(FIXTURE_FULL, "projects", "proj-a", "docs", "product", "prd.md")),
    ).toBe(true);
  });

  it("frd-01: proj-a has docs/product/architecture.md", () => {
    expect(
      fs.existsSync(
        path.join(FIXTURE_FULL, "projects", "proj-a", "docs", "product", "architecture.md"),
      ),
    ).toBe(true);
  });

  it("frd-01: proj-a has at least one FRD module (frd-01-x/frd.md)", () => {
    expect(
      fs.existsSync(
        path.join(FIXTURE_FULL, "projects", "proj-a", "docs", "frds", "frd-01-x", "frd.md"),
      ),
    ).toBe(true);
  });

  it("frd-01: proj-a FRD module has blueprint.md", () => {
    expect(
      fs.existsSync(
        path.join(FIXTURE_FULL, "projects", "proj-a", "docs", "frds", "frd-01-x", "blueprint.md"),
      ),
    ).toBe(true);
  });

  it("frd-01: proj-a FRD module has mocks/ directory", () => {
    expect(
      fs.existsSync(
        path.join(FIXTURE_FULL, "projects", "proj-a", "docs", "frds", "frd-01-x", "mocks"),
      ),
    ).toBe(true);
  });

  it("frd-01: proj-a FRD module has work-orders/ directory", () => {
    expect(
      fs.existsSync(
        path.join(FIXTURE_FULL, "projects", "proj-a", "docs", "frds", "frd-01-x", "work-orders"),
      ),
    ).toBe(true);
  });

  it("frd-01: proj-a has docs/adr/ with at least one ADR", () => {
    const dir = path.join(FIXTURE_FULL, "projects", "proj-a", "docs", "adr");
    expect(fs.existsSync(dir)).toBe(true);
    expect(fs.readdirSync(dir).length).toBeGreaterThan(0);
  });

  it("frd-01: proj-a has docs/decision-log.md", () => {
    expect(
      fs.existsSync(path.join(FIXTURE_FULL, "projects", "proj-a", "docs", "decision-log.md")),
    ).toBe(true);
  });

  // REQ-01-007 — .pandacorp/ comms
  it("frd-01: proj-a has .pandacorp/comms/progress.md", () => {
    expect(
      fs.existsSync(
        path.join(FIXTURE_FULL, "projects", "proj-a", ".pandacorp", "comms", "progress.md"),
      ),
    ).toBe(true);
  });

  it("frd-01: proj-a has .pandacorp/inbox/decisions.md", () => {
    expect(
      fs.existsSync(
        path.join(FIXTURE_FULL, "projects", "proj-a", ".pandacorp", "inbox", "decisions.md"),
      ),
    ).toBe(true);
  });

  it("frd-01: proj-a has at least one .pandacorp/inbox/bugs/ file", () => {
    const bugsDir = path.join(FIXTURE_FULL, "projects", "proj-a", ".pandacorp", "inbox", "bugs");
    expect(fs.existsSync(bugsDir)).toBe(true);
    expect(fs.readdirSync(bugsDir).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// AC-01-000.3 — tolerance cases are present in the fixtures
// ---------------------------------------------------------------------------

describe("frd-01 fixtures: AC-01-000.3 — tolerance cases", () => {
  // Malformed idea card — must be present; readers must skip it, not crash
  it("frd-01: FIXTURE_FULL has idea-malformed.md with broken frontmatter (regression: gray-matter throws)", () => {
    const p = path.join(FIXTURE_FULL, "factory", "ideas", "idea-malformed.md");
    expect(fs.existsSync(p)).toBe(true);
    const raw = fs.readFileSync(p, "utf-8");
    // The frontmatter delimiter is present but the content is intentionally broken.
    expect(raw).toContain("---");
    // Confirm the title is unterminated (the actual defect from bug-1.md).
    expect(raw).toMatch(/title:.*"[^"]*\n/);
  });

  // NON_IDEA_FILES must be present (so readers can prove they skip them)
  it("frd-01: _idea-template.md is present in ideas/ (must be ignored by readIdeas)", () => {
    expect(fs.existsSync(path.join(FIXTURE_FULL, "factory", "ideas", "_idea-template.md"))).toBe(
      true,
    );
  });

  it("frd-01: decision-log.md is present in ideas/ (must be ignored by readIdeas)", () => {
    expect(fs.existsSync(path.join(FIXTURE_FULL, "factory", "ideas", "decision-log.md"))).toBe(
      true,
    );
  });

  // All five IdeaStatus values are represented
  it("frd-01: fixture covers all five idea statuses", () => {
    const ideasDir = path.join(FIXTURE_FULL, "factory", "ideas");
    const files = fs.readdirSync(ideasDir);
    const names = new Set(files);
    expect(names.has("idea-discovered.md")).toBe(true);
    expect(names.has("idea-recommended.md")).toBe(true);
    expect(names.has("idea-in-pipeline.md")).toBe(true);
    expect(names.has("idea-shipped.md")).toBe(true);
    expect(names.has("idea-discarded.md")).toBe(true);
  });

  // in-pipeline idea has a project pointer
  it("frd-01: in-pipeline idea has a project: field (pointer to proj-a)", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURE_FULL, "factory", "ideas", "idea-in-pipeline.md"),
      "utf-8",
    );
    expect(raw).toContain("project:");
  });

  // Portfolio tolerance cases
  it("frd-01: portfolio.md contains a row with missing repo (—)", () => {
    const raw = fs.readFileSync(path.join(FIXTURE_FULL, "factory", "portfolio.md"), "utf-8");
    expect(raw).toContain("—");
  });

  it("frd-01: portfolio.md contains a row with a broken/nonexistent path (REQ-01-010)", () => {
    const raw = fs.readFileSync(path.join(FIXTURE_FULL, "factory", "portfolio.md"), "utf-8");
    // The broken path row points to /nonexistent/path/does/not/exist
    expect(raw).toMatch(/nonexistent/);
  });

  // Malformed YAML status for proj-b
  it("frd-01: proj-b status.yaml is present and malformed (tolerance case)", () => {
    const p = path.join(FIXTURE_FULL, "projects", "proj-b", ".pandacorp", "status.yaml");
    expect(fs.existsSync(p)).toBe(true);
    const raw = fs.readFileSync(p, "utf-8");
    // Must contain something unparseable as YAML
    expect(raw.length).toBeGreaterThan(0);
    // The content is intentionally broken YAML (not a valid mapping)
    expect(raw).toContain(": this is not valid yaml");
  });

  // Events: malformed line present
  it("frd-01: events NDJSON has a malformed line among valid lines (readEvents must skip it)", () => {
    const raw = fs.readFileSync(FIXTURE_EVENTS_NDJSON, "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const malformed = lines.filter((l) => {
      try {
        JSON.parse(l);
        return false;
      } catch {
        return true;
      }
    });
    expect(malformed).toHaveLength(1);
    expect(malformed[0]).toContain("NOT VALID JSON");
  });

  // Events: lines without a `project` field (legacy/global)
  it("frd-01: events NDJSON has lines without a project field (legacy/global events)", () => {
    const raw = fs.readFileSync(FIXTURE_EVENTS_NDJSON, "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const validEvents = lines.flatMap((l) => {
      try {
        return [JSON.parse(l) as { project?: unknown }];
      } catch {
        return [];
      }
    });
    const withoutProject = validEvents.filter((e) => e.project === undefined);
    expect(withoutProject.length).toBeGreaterThan(0);
  });

  // Events: empty NDJSON file
  it("frd-01: empty events NDJSON exists and is zero-length", () => {
    expect(fs.existsSync(FIXTURE_EVENTS_EMPTY_NDJSON)).toBe(true);
    const stat = fs.statSync(FIXTURE_EVENTS_EMPTY_NDJSON);
    expect(stat.size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// AC-01-000.2 — withFactoryRoot harness
// ---------------------------------------------------------------------------

describe("frd-01 fixtures: AC-01-000.2 — withFactoryRoot harness", () => {
  // Snapshot the env before each test so we can assert restoration.
  let envBefore: string | undefined;

  beforeEach(() => {
    envBefore = process.env.PANDACORP_FACTORY_ROOT;
  });

  afterEach(() => {
    // Defensive: ensure env is restored even if a test fails mid-flight.
    if (envBefore === undefined) {
      delete process.env.PANDACORP_FACTORY_ROOT;
    } else {
      process.env.PANDACORP_FACTORY_ROOT = envBefore;
    }
  });

  it("frd-01: WHEN withFactoryRoot(FIXTURE_FULL, fn) runs THEN resolveFactoryRoot() returns FIXTURE_FULL", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const resolved = resolveFactoryRoot(process.env.PANDACORP_FACTORY_ROOT);
      expect(resolved).toBe(FIXTURE_FULL);
    });
  });

  it("frd-01: WHEN withFactoryRoot(FIXTURE_FRESH, fn) runs THEN resolveFactoryRoot() returns FIXTURE_FRESH", async () => {
    await withFactoryRoot(FIXTURE_FRESH, () => {
      const resolved = resolveFactoryRoot(process.env.PANDACORP_FACTORY_ROOT);
      expect(resolved).toBe(FIXTURE_FRESH);
    });
  });

  it("frd-01: AFTER withFactoryRoot finishes THEN PANDACORP_FACTORY_ROOT is restored to its prior value", async () => {
    // Set a known prior value.
    const prior = "/tmp/some-prior-root";
    process.env.PANDACORP_FACTORY_ROOT = prior;

    await withFactoryRoot(FIXTURE_FULL, () => {
      expect(process.env.PANDACORP_FACTORY_ROOT).toBe(FIXTURE_FULL);
    });

    expect(process.env.PANDACORP_FACTORY_ROOT).toBe(prior);
  });

  it("frd-01: WHEN no prior PANDACORP_FACTORY_ROOT THEN withFactoryRoot deletes the var after the callback", async () => {
    delete process.env.PANDACORP_FACTORY_ROOT;

    await withFactoryRoot(FIXTURE_FULL, () => {
      expect(process.env.PANDACORP_FACTORY_ROOT).toBe(FIXTURE_FULL);
    });

    expect(process.env.PANDACORP_FACTORY_ROOT).toBeUndefined();
  });

  it("frd-01: withFactoryRoot restores the env even when the callback throws", async () => {
    const prior = "/tmp/error-test-root";
    process.env.PANDACORP_FACTORY_ROOT = prior;

    await expect(
      withFactoryRoot(FIXTURE_FULL, () => {
        throw new Error("intentional error in callback");
      }),
    ).rejects.toThrow("intentional error in callback");

    expect(process.env.PANDACORP_FACTORY_ROOT).toBe(prior);
  });

  it("frd-01: withFactoryRoot is nestable — inner scope overrides, outer scope restores", async () => {
    await withFactoryRoot(FIXTURE_FULL, async () => {
      expect(process.env.PANDACORP_FACTORY_ROOT).toBe(FIXTURE_FULL);

      await withFactoryRoot(FIXTURE_FRESH, () => {
        expect(process.env.PANDACORP_FACTORY_ROOT).toBe(FIXTURE_FRESH);
      });

      // Restored to the outer scope after inner completes.
      expect(process.env.PANDACORP_FACTORY_ROOT).toBe(FIXTURE_FULL);
    });
  });

  it("frd-01: withFactoryRoot resolves an async callback and returns its value", async () => {
    const result = await withFactoryRoot(FIXTURE_FULL, async () => {
      return 42;
    });
    expect(result).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// Fixture content integrity — profile.md fields
// ---------------------------------------------------------------------------

describe("frd-01 fixtures: profile.md content (REQ-01-002)", () => {
  it("frd-01: FULL profile.md has name, goals, interests, assets and projects_path in frontmatter", () => {
    const raw = fs.readFileSync(path.join(FIXTURE_FULL, "factory", "profile.md"), "utf-8");
    expect(raw).toContain("name:");
    expect(raw).toContain("goals:");
    expect(raw).toContain("interests:");
    expect(raw).toContain("assets:");
    expect(raw).toContain("projects_path:");
  });

  it("frd-01: FULL profile.md has a markdown body (personalization content)", () => {
    const raw = fs.readFileSync(path.join(FIXTURE_FULL, "factory", "profile.md"), "utf-8");
    // Body follows the closing --- delimiter
    const parts = raw.split("---");
    expect(parts.length).toBeGreaterThanOrEqual(3);
    const body = parts.slice(2).join("---").trim();
    expect(body.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Fixture content integrity — status.yaml (REQ-01-005)
// ---------------------------------------------------------------------------

describe("frd-01 fixtures: status.yaml content (REQ-01-005)", () => {
  it("frd-01: proj-a status.yaml contains all required fields", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURE_FULL, "projects", "proj-a", ".pandacorp", "status.yaml"),
      "utf-8",
    );
    // All fields listed in REQ-01-005 must be present
    expect(raw).toContain("phase:");
    expect(raw).toContain("version:");
    expect(raw).toContain("running:");
    expect(raw).toContain("work_orders_total:");
    expect(raw).toContain("work_orders_done:");
    expect(raw).toContain("pending_decisions:");
    expect(raw).toContain("pending_bugs:");
    expect(raw).toContain("last_green_sha:");
    expect(raw).toContain("safe_to_test:");
  });

  it("frd-01: proj-a phase is a valid Phase enum value", () => {
    const raw = fs.readFileSync(
      path.join(FIXTURE_FULL, "projects", "proj-a", ".pandacorp", "status.yaml"),
      "utf-8",
    );
    const validPhases = [
      "product",
      "design",
      "architecture",
      "implementation",
      "release",
      "operation",
    ];
    const phaseMatch = raw.match(/^phase:\s*(\S+)/m);
    expect(phaseMatch).not.toBeNull();
    if (phaseMatch) {
      expect(validPhases).toContain(phaseMatch[1]);
    }
  });
});

// ---------------------------------------------------------------------------
// Fixture content integrity — events (REQ-01-009/REQ-01-008)
// ---------------------------------------------------------------------------

describe("frd-01 fixtures: events NDJSON content (REQ-01-008/REQ-01-009)", () => {
  it("frd-01: NDJSON has at least 10 lines total (valid + malformed)", () => {
    const raw = fs.readFileSync(FIXTURE_EVENTS_NDJSON, "utf-8");
    const nonEmpty = raw.split("\n").filter((l) => l.trim().length > 0);
    expect(nonEmpty.length).toBeGreaterThanOrEqual(10);
  });

  it("frd-01: valid events have required `event` and `at` fields", () => {
    const raw = fs.readFileSync(FIXTURE_EVENTS_NDJSON, "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const valid = lines.flatMap((l) => {
      try {
        return [JSON.parse(l) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
    for (const ev of valid) {
      expect(typeof ev.event).toBe("string");
      expect(typeof ev.at).toBe("string");
    }
  });

  it("frd-01: valid events with project field all use the same fixture project name", () => {
    const raw = fs.readFileSync(FIXTURE_EVENTS_NDJSON, "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const withProject = lines.flatMap((l) => {
      try {
        const ev = JSON.parse(l) as Record<string, unknown>;
        return ev.project !== undefined ? [ev.project] : [];
      } catch {
        return [];
      }
    });
    // All events with a project must reference "proj-a" (the only project in the fixture)
    for (const proj of withProject) {
      expect(proj).toBe("proj-a");
    }
  });

  it("frd-01: events are in chronological order by `at` timestamp", () => {
    const raw = fs.readFileSync(FIXTURE_EVENTS_NDJSON, "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    const timestamps = lines.flatMap((l) => {
      try {
        const ev = JSON.parse(l) as Record<string, unknown>;
        return typeof ev.at === "string" ? [ev.at as string] : [];
      } catch {
        return [];
      }
    });
    for (let i = 1; i < timestamps.length; i++) {
      const cur = timestamps[i] ?? "";
      const prev = timestamps[i - 1] ?? "";
      expect(cur >= prev).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// FIXTURES_DIR is absolute and exists
// ---------------------------------------------------------------------------

describe("frd-01 fixtures: FIXTURES_DIR meta", () => {
  it("frd-01: FIXTURES_DIR is an absolute path", () => {
    expect(path.isAbsolute(FIXTURES_DIR)).toBe(true);
  });

  it("frd-01: FIXTURE_FULL, FIXTURE_FRESH and FIXTURE_EVENTS_DIR are children of FIXTURES_DIR", () => {
    expect(FIXTURE_FULL.startsWith(FIXTURES_DIR)).toBe(true);
    expect(FIXTURE_FRESH.startsWith(FIXTURES_DIR)).toBe(true);
    expect(FIXTURE_EVENTS_DIR.startsWith(FIXTURES_DIR)).toBe(true);
  });
});
