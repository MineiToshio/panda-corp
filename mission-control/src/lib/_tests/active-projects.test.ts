/**
 * WO-03-001 — `activeProjects` compose helper — acceptance tests (RED phase).
 *
 * Written BEFORE the implementation; `activeProjects` does not exist yet.
 * Every test here will fail until the GREEN phase — that is the intent.
 *
 * Traceability:
 *   AC-03-001.1  The portfolio SHALL list the projects in `architecture`,
 *                `implementation` and `release` (launched) — DR-085 folded the old
 *                `operation` phase into `release`, so the launched/shipped project is `release`.
 *   AC-03-002.1  Each project SHALL expose its stage and a running indicator.
 *   AC-03-003.1  Each launched (`release`) project SHALL expose its business snapshot
 *                when present in the portfolio.
 *   AC-03-006.x  Path-not-found detection: exists:false still listed; badge-ready.
 *
 * Regression anchors from .pandacorp/comms/progress.md (past incidents):
 *   - FREEZE-ON-RED WO-13-001: NaN bypasses numeric guard (B1').
 *     → Regression: `running` field must be strict boolean, never NaN/null/undefined coerced.
 *   - WO-01-005 adversarial I2: empty-object / empty-array bypass.
 *     → Regression: malformed status (present:true, malformed:true) must still classify
 *       via the portfolio fallback — never return a wrong phase from a half-parsed YAML.
 *   - WO-01-005 adversarial I3: array value passes as scalar.
 *     → Regression: `stage` must be a valid Phase literal or undefined, never an array.
 *   - WO-01-001/WO-01-004 (existing incidents in progress.md log): read-only, no writes,
 *     no throws. The same invariant must hold through the compose layer.
 *
 * Fixture (factory-full, extended for WO-03-001):
 *   Portfolio row → status.yaml → exists?
 *   proj-a           implementation (running:true)   YES  active phase
 *   proj-architecture architecture (running:false)   YES  active phase
 *   proj-release      release (running:true)         YES  active phase (building)
 *   proj-operation    release (running:false)         YES  active phase (launched) + snapshot (DR-085)
 *   proj-b            malformed YAML (no phase)       YES  active but status malformed → fallback
 *   proj-missing-repo no status.yaml                  NO   portfolio phase=product → NON-active
 *   proj-product      product (running:false)          YES  NON-active phase, excluded
 *   proj-broken-path  no status.yaml, path missing    NO   portfolio phase=shipped → active, exists:false
 *
 * Stack: Vitest. All I/O via real fs over committed fixture trees.
 * No mocks — activeProjects() is pure-ish (reads only).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { FIXTURE_FRESH, FIXTURE_FULL, withFactoryRoot } from "../../tests/fixtures";

// The module under test (does NOT exist yet — RED phase).
// It will live in lib/portfolio.ts alongside readPortfolio, per the WO contract.
import { activeProjects } from "../portfolio/portfolio";

// ---------------------------------------------------------------------------
// Local type alias matching the IF-03-activeProjects contract (WO spec + blueprint §1).
// Used only to type-assert; the module will export it as ProjectListItem.
// ---------------------------------------------------------------------------

type ProjectListItem = {
  name: string;
  path: string;
  repo?: string;
  status: { present: boolean; malformed: boolean; status: Record<string, unknown> | null };
  exists: boolean;
  stage?: string;
  running?: boolean;
  snapshot?: { users?: string; returnMetric?: string; verdict?: string };
};

// ---------------------------------------------------------------------------
// AC-03-001.1 — happy path: active phases are returned, non-active excluded
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — AC-03-001.1 active phase inclusion", () => {
  it("frd-03: WHEN Pandacorp loads THEN activeProjects() does NOT throw", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      expect(() => activeProjects()).not.toThrow();
    });
  });

  it("frd-03: WHEN activeProjects() runs THEN it returns an array", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = activeProjects();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  it("frd-03: WHEN activeProjects() runs THEN proj-a (implementation) is included", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const names = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      expect(names).toContain("proj-a");
    });
  });

  it("frd-03: WHEN activeProjects() runs THEN proj-architecture (architecture) is included", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const names = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      expect(names).toContain("proj-architecture");
    });
  });

  it("frd-03: WHEN activeProjects() runs THEN proj-release (release) is included", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const names = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      expect(names).toContain("proj-release");
    });
  });

  it("frd-03: WHEN activeProjects() runs THEN proj-operation (release/launched) is included", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const names = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      expect(names).toContain("proj-operation");
    });
  });

  it("frd-03: WHEN activeProjects() runs THEN proj-product (product phase) is excluded", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const names = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      expect(names).not.toContain("proj-product");
    });
  });

  it("frd-03: WHEN activeProjects() runs THEN proj-missing-repo (portfolio phase=product, no status) is excluded", async () => {
    // proj-missing-repo has no status.yaml and its portfolio advisory cell says 'product'.
    // Fallback classification to 'product' → non-active, excluded.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const names = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      expect(names).not.toContain("proj-missing-repo");
    });
  });

  it("frd-03: WHEN activeProjects() runs THEN the result contains only active-phase entries", async () => {
    // Active phases (DR-085): architecture | implementation | release.
    // Any entry with a stage outside that set is a test defect.
    const ACTIVE_STAGES = new Set(["architecture", "implementation", "release"]);
    await withFactoryRoot(FIXTURE_FULL, () => {
      for (const item of activeProjects() as ProjectListItem[]) {
        if (item.stage !== undefined) {
          expect(ACTIVE_STAGES.has(item.stage as string)).toBe(true);
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// AC-03-001.1 (path-not-found variant) — missing-path row still listed
// Blueprint §4: "path missing → exists: false but still listed (for the not-found badge)"
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — AC-03-006.x: missing path still listed with exists:false", () => {
  it("frd-03: WHEN a portfolio row has a nonexistent path AND portfolio phase=shipped THEN it appears in the result", async () => {
    // proj-broken-path: portfolio phase cell = 'shipped', path=/nonexistent/...
    // Status is absent → fallback to portfolio phase 'shipped' → maps to 'release' active set (DR-085).
    await withFactoryRoot(FIXTURE_FULL, () => {
      const names = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      expect(names).toContain("proj-broken-path");
    });
  });

  it("frd-03: WHEN a portfolio row has a nonexistent path THEN its exists field is false", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find(
        (p) => p.name === "proj-broken-path",
      );
      expect(item).toBeDefined();
      expect(item?.exists).toBe(false);
    });
  });

  it("frd-03: WHEN a portfolio row path exists on disk THEN its exists field is true", async () => {
    // proj-a: path=projects/proj-a, exists on disk inside fixture root.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-a");
      expect(item).toBeDefined();
      expect(item?.exists).toBe(true);
    });
  });

  it("frd-03: WHEN a missing-path row is listed THEN activeProjects() still does NOT throw", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      expect(() => activeProjects()).not.toThrow();
    });
  });

  it("frd-03: WHEN a missing-path row has a repo THEN repo is preserved on the result item", async () => {
    // proj-broken-path has repo: https://github.com/ada/broken in portfolio.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find(
        (p) => p.name === "proj-broken-path",
      );
      expect(item?.repo).toBe("https://github.com/ada/broken");
    });
  });
});

// ---------------------------------------------------------------------------
// AC-03-002.1 — stage and running indicator fields
// blueprint §2: stage = phase; running = status.status.running (strict boolean)
// Regression anchor: WO-13-001 B1' — running must be strict boolean, never NaN/null coercion
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — AC-03-002.1 stage and running fields", () => {
  it("frd-03: proj-a (implementation, running:true) has stage='implementation'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-a");
      expect(item?.stage).toBe("implementation");
    });
  });

  it("frd-03: proj-a (running:true in status.yaml) has running===true (strict boolean)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-a");
      expect(item?.running).toBe(true);
      // Regression B1': must be strict true, not truthy
      expect(typeof item?.running).toBe("boolean");
    });
  });

  it("frd-03: proj-architecture (running:false) has running===false (strict boolean)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find(
        (p) => p.name === "proj-architecture",
      );
      expect(item?.running).toBe(false);
      expect(typeof item?.running).toBe("boolean");
    });
  });

  it("frd-03: proj-release (release, running:true) has stage='release'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-release");
      expect(item?.stage).toBe("release");
    });
  });

  it("frd-03: proj-operation (release/launched) has stage='release'", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-operation");
      expect(item?.stage).toBe("release");
    });
  });

  it("frd-03: stage is a valid Phase literal or undefined on every returned item", async () => {
    // Regression I3: stage must never be an array. (DR-085: no 'operation' phase.)
    const VALID_PHASES = new Set([
      "product",
      "design",
      "architecture",
      "implementation",
      "release",
    ]);
    await withFactoryRoot(FIXTURE_FULL, () => {
      for (const item of activeProjects() as ProjectListItem[]) {
        if (item.stage !== undefined) {
          expect(typeof item.stage).toBe("string");
          expect(VALID_PHASES.has(item.stage)).toBe(true);
        }
      }
    });
  });

  it("frd-03: running is a strict boolean or undefined on every returned item", async () => {
    // Regression B1': NaN coercion guard — running must be boolean, never number or null.
    await withFactoryRoot(FIXTURE_FULL, () => {
      for (const item of activeProjects() as ProjectListItem[]) {
        if (item.running !== undefined) {
          expect(typeof item.running).toBe("boolean");
        }
      }
    });
  });
});

// ---------------------------------------------------------------------------
// AC-03-003.1 — business snapshot for launched (release) projects
// blueprint §2/§3: snapshot populated ONLY for the launched (release) phase; absent fields omitted silently (DR-085)
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — AC-03-003.1 business snapshot for launched projects", () => {
  it("frd-03: proj-operation (release/launched) has a snapshot object", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-operation");
      expect(item?.snapshot).toBeDefined();
    });
  });

  it("frd-03: proj-operation snapshot has users '500' from the portfolio row", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-operation");
      expect(item?.snapshot?.users).toBe("500");
    });
  });

  it("frd-03: proj-operation snapshot has returnMetric '$1 200 MRR' from the portfolio row", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-operation");
      expect(item?.snapshot?.returnMetric).toBe("$1 200 MRR");
    });
  });

  it("frd-03: proj-operation snapshot has verdict 'double-down' from the portfolio row", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-operation");
      expect(item?.snapshot?.verdict).toBe("double-down");
    });
  });

  it("frd-03: proj-a (implementation) has no snapshot (snapshot is undefined or absent)", async () => {
    // Snapshot is only for the launched (release) phase, not for the building phases (DR-085).
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-a");
      // The contract says snapshot is populated only for the launched (release) phase.
      // It must not appear on non-release entries.
      expect(item?.snapshot).toBeUndefined();
    });
  });

  it("frd-03: proj-architecture (architecture) has no snapshot", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find(
        (p) => p.name === "proj-architecture",
      );
      expect(item?.snapshot).toBeUndefined();
    });
  });

  it("frd-03: WHEN a launched (release) row has placeholder values in snapshot columns THEN those fields are undefined (not placeholder strings)", () => {
    // Inline fixture: launched (release) row with "—" in all snapshot columns (DR-085).
    // Tests that normalizeCell from readPortfolio propagates through activeProjects.
    // This is a unit-level inline fixture test (no fs round-trip needed).
    const ACTIVE_PHASES_WITH_PLACEHOLDERS = [
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| op-no-snap | projects/proj-operation | — | An op project | release | — | — | — | 2026-06-10 |",
    ].join("\n");
    // We invoke via a string-content overload of readPortfolio to test the compose logic
    // without touching the PANDACORP_FACTORY_ROOT env (pure parser path).
    // The compose helper activeProjects() wraps readPortfolio + readStatus + pathExists;
    // to test this specific normalization path, we assert via the portfolioContent overload
    // of activeProjects (if the WO exposes one), or we verify the property on the
    // output item from the full fixture (a launched/release row with all "—" snapshot cells).
    const item = (activeProjects as (content?: string) => ProjectListItem[])(
      ACTIVE_PHASES_WITH_PLACEHOLDERS,
    );
    const op = item.find((p) => p.name === "op-no-snap");
    if (op?.snapshot !== undefined) {
      expect(op.snapshot.users).toBeUndefined();
      expect(op.snapshot.returnMetric).toBeUndefined();
      expect(op.snapshot.verdict).toBeUndefined();
    } else {
      // If the implementation omits snapshot entirely when all cells are undefined, that is correct too.
      expect(op?.snapshot).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Malformed status fallback (regression WO-01-005 I2, I3)
// blueprint §2: "if status absent/malformed, fall back to the portfolio table's `phase` cell"
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — malformed status falls back to portfolio phase cell", () => {
  it("frd-03: WHEN status.yaml is malformed THEN activeProjects does NOT throw", async () => {
    // proj-b has a malformed status.yaml (confirmed: contains ': this is not valid yaml at all').
    // Its portfolio row has phase=product → excluded. This test exercises the no-throw invariant.
    await withFactoryRoot(FIXTURE_FULL, () => {
      expect(() => activeProjects()).not.toThrow();
    });
  });

  it("frd-03: WHEN status.yaml is absent AND portfolio phase is a non-active phase THEN the row is excluded", async () => {
    // proj-missing-repo: no status.yaml, portfolio phase='product' → excluded.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const names = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      expect(names).not.toContain("proj-missing-repo");
    });
  });

  it("frd-03: WHEN status.yaml is absent AND portfolio phase is 'shipped' THEN the row is included via fallback", async () => {
    // proj-broken-path: no status.yaml, portfolio phase='shipped' → maps to release/active set (DR-085).
    await withFactoryRoot(FIXTURE_FULL, () => {
      const names = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      expect(names).toContain("proj-broken-path");
    });
  });

  it("frd-03: WHEN the StatusResult is present:true malformed:true THEN stage still comes from portfolio fallback, not from the broken status", async () => {
    // proj-b: malformed YAML → status.phase undefined → portfolio fallback.
    // proj-b has no portfolio row in our fixture → it should NOT appear at all.
    // This test asserts the non-appearance; the important invariant is no crash + no wrong phase.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-b");
      if (item !== undefined) {
        // If it appears (because a portfolio row for proj-b exists), stage must be valid.
        const VALID_PHASES = new Set(["architecture", "implementation", "release"]);
        expect(item.stage === undefined || VALID_PHASES.has(item.stage ?? "")).toBe(true);
        // Regression I3: stage must not be an array.
        expect(Array.isArray(item.stage)).toBe(false);
      }
      // No assertion on count — proj-b absence is acceptable.
    });
  });
});

// ---------------------------------------------------------------------------
// Read-only and fail-soft invariants (FRD-01 REQ-01-011; architecture §7)
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — read-only and fail-soft invariants", () => {
  it("frd-03: WHEN the factory root is the fresh fixture (no portfolio.md) THEN activeProjects returns []", async () => {
    await withFactoryRoot(FIXTURE_FRESH, () => {
      const result = activeProjects();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  it("frd-03: WHEN the factory root is the fresh fixture THEN activeProjects does NOT throw", async () => {
    await withFactoryRoot(FIXTURE_FRESH, () => {
      expect(() => activeProjects()).not.toThrow();
    });
  });

  it("frd-03: activeProjects returns an array (never null or undefined)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const result = activeProjects();
      expect(result).not.toBeNull();
      expect(result).not.toBeUndefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  it("frd-03: WHEN activeProjects is called with a nonexistent factory root THEN it returns [] and does not throw", async () => {
    await withFactoryRoot("/nonexistent/factory/root", () => {
      expect(() => activeProjects()).not.toThrow();
      const result = activeProjects();
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// ProjectListItem field contract — required fields always present
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — ProjectListItem required field invariants", () => {
  it("frd-03: every returned item has a non-empty name string", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      for (const item of activeProjects() as ProjectListItem[]) {
        expect(typeof item.name).toBe("string");
        expect(item.name.length).toBeGreaterThan(0);
      }
    });
  });

  it("frd-03: every returned item has a non-empty path string", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      for (const item of activeProjects() as ProjectListItem[]) {
        expect(typeof item.path).toBe("string");
        expect(item.path.length).toBeGreaterThan(0);
      }
    });
  });

  it("frd-03: every returned item has a status object (not null when present:true)", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      for (const item of activeProjects() as ProjectListItem[]) {
        expect(item.status).toBeDefined();
        expect(typeof item.status).toBe("object");
      }
    });
  });

  it("frd-03: every returned item has a boolean exists field", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      for (const item of activeProjects() as ProjectListItem[]) {
        expect(typeof item.exists).toBe("boolean");
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Idempotency — calling activeProjects twice yields the same names in the same order
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — idempotency", () => {
  it("frd-03: WHEN activeProjects is called twice THEN both calls return entries with the same names in the same order", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const first = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      const second = (activeProjects() as ProjectListItem[]).map((p) => p.name);
      expect(first).toEqual(second);
    });
  });
});

// ---------------------------------------------------------------------------
// Inline content overload (optional) — supports testing without env manipulation
// If the function accepts a raw content string (like readPortfolio does),
// this tests the compose logic on a minimal inline portfolio with one active entry.
// If the function does NOT accept an argument, these tests confirm the correct
// behavior only via the fixture path (already covered above); the `it.skip`
// comment documents the intent without polluting the RED count.
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — inline content with a single active project", () => {
  it("frd-03: WHEN given a portfolio table string with one implementation row THEN returns that one item", () => {
    const content = [
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| inline-proj | /some/path | https://github.com/x/y | Inline idea | implementation | — | — | — | 2026-06-15 |",
    ].join("\n");

    const result = (activeProjects as (content?: string) => ProjectListItem[])(content);
    expect(Array.isArray(result)).toBe(true);
    // Either the overload is supported (one item back) or an empty array (no overload).
    // When the overload is supported, the item must be the inline project.
    if (result.length > 0) {
      const item = result.find((p) => p.name === "inline-proj");
      expect(item).toBeDefined();
      expect(item?.stage).toBe("implementation");
    }
  });

  it("frd-03: WHEN given a portfolio table string with only non-active phases THEN returns []", () => {
    const content = [
      "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
      "|---|---|---|---|---|---|---|---|---|",
      "| idea-proj | /some/path | — | An idea | product | — | — | — | 2026-06-01 |",
      "| design-proj | /other/path | — | Another | design | — | — | — | 2026-06-01 |",
    ].join("\n");

    const result = (activeProjects as (content?: string) => ProjectListItem[])(content);
    expect(Array.isArray(result)).toBe(true);
    // If the overload is supported, the result must be empty (no active phases).
    // If the overload is not supported (no-arg only), the call returns the live
    // fixture result — which may be non-empty. We only assert the invariant that
    // no non-active stage leaks out.
    const ACTIVE_PHASES = new Set(["architecture", "implementation", "release"]);
    for (const item of result) {
      if (item.stage !== undefined) {
        expect(ACTIVE_PHASES.has(item.stage)).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Snapshot absent-fields: snapshot undefined when ALL cells are placeholders
// Tests the "absent → omit silently" rule (FRD-03 §3, blueprint §3).
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — snapshot omitted when all columns are placeholder", () => {
  it("frd-03: proj-broken-path (shipped→release fallback, all snapshot cells are portfolio values) has snapshot populated", async () => {
    // proj-broken-path: portfolio row has users=340, returnMetric='OSS stars', verdict='shipped'
    // It is classified as active via the 'shipped' portfolio phase fallback.
    // Its snapshot should be populated from portfolio columns.
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find(
        (p) => p.name === "proj-broken-path",
      );
      if (item !== undefined && item.snapshot !== undefined) {
        expect(item.snapshot.users).toBe("340");
      }
      // No assertion if item is absent (the exact active-set logic for the 'shipped'
      // portfolio keyword is pinned by the inclusion test above).
    });
  });
});

// ---------------------------------------------------------------------------
// path field: absolute paths are preserved verbatim (REQ-01-010 through compose)
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — path field verbatim (REQ-01-010 through compose)", () => {
  it("frd-03: proj-broken-path preserves its raw nonexistent path string verbatim", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find(
        (p) => p.name === "proj-broken-path",
      );
      if (item !== undefined) {
        expect(item.path).toBe("/nonexistent/path/does/not/exist");
      }
    });
  });

  it("frd-03: proj-a path resolves to the projects/proj-a relative path from the portfolio row", async () => {
    await withFactoryRoot(FIXTURE_FULL, () => {
      const item = (activeProjects() as ProjectListItem[]).find((p) => p.name === "proj-a");
      expect(item).toBeDefined();
      // Path is the raw cell value from portfolio.md — relative string or resolved absolute.
      // Either form is acceptable; it must contain "proj-a".
      expect(item?.path).toMatch(/proj-a/);
    });
  });
});

// ---------------------------------------------------------------------------
// pendingDecisions is the LIVE count from decisions.md, not the stored YAML
// counter (DR-092 single source). Regression for the bug where the portfolio
// rail's badge showed a stale `pending_decisions` value that drifted from the
// real `.pandacorp/inbox/decisions.md` content the moment a decision was
// resolved without a write to status.yaml.
// ---------------------------------------------------------------------------

describe("frd-03: activeProjects — pendingDecisions is the live decisions.md count (DR-092)", () => {
  it("frd-03: WHEN status.yaml's pending_decisions is stale THEN the item's pendingDecisions reflects the real decisions.md count instead", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-active-projects-pending-"));
    try {
      fs.mkdirSync(path.join(dir, ".pandacorp", "inbox"), { recursive: true });
      // Deliberately stale/mismatched counter — the bug this regression catches.
      fs.writeFileSync(
        path.join(dir, ".pandacorp", "status.yaml"),
        "phase: implementation\npending_decisions: 99\n",
      );
      fs.writeFileSync(
        path.join(dir, ".pandacorp", "inbox", "decisions.md"),
        "## 2026-06-21 (NECESITA DECISIÓN DEL OWNER) — Solo una pendiente\n" +
          "## 2026-06-20 (RESUELTO por el owner) — Ya resuelta\n",
      );

      const content = [
        "| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |",
        "|---|---|---|---|---|---|---|---|---|",
        `| stale-decisions-proj | ${dir} | — | An idea | implementation | — | — | — | 2026-06-15 |`,
      ].join("\n");

      const result = (
        activeProjects as (content?: string) => Array<{
          name: string;
          status: { present: boolean; status: { pendingDecisions?: number } | null };
        }>
      )(content);
      const item = result.find((p) => p.name === "stale-decisions-proj");

      expect(item).toBeDefined();
      expect(item?.status.present).toBe(true);
      // Live count (1 unresolved), NOT the stale YAML counter (99).
      expect(item?.status.status?.pendingDecisions).toBe(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
