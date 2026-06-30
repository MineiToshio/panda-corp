/**
 * WO-05-001 — `lib/work-orders.ts`: discover + parse work orders — RED phase
 *
 * Tests are written BEFORE the implementation. `listWorkOrders` does not yet
 * exist in lib/work-orders.ts; every test here will fail (RED) until the GREEN
 * phase. That is the intent.
 *
 * Traceability:
 *   AC-05-002.1  EACH card SHALL show its FRD via a chip (the source feature
 *                frd-NN-<slug>). → Every WorkOrder must carry a `frd` field
 *                equal to the parent feature slug.
 *   AC-05-005.1  The kanban SHALL be read-only — state comes from the files
 *                written by the agents. → listWorkOrders never writes; state
 *                is derived, not set.
 *   WO-05-001 §Scope
 *     • `listWorkOrders(projectPath): WorkOrder[]` — discovers across all
 *       features at docs/frds/frd-STAR/work-orders/wo-STAR.md.
 *     • Derives WorkOrderState from the on-disk marker.
 *     • Partial-tolerant: unparseable WO → state "todo"; absent work-orders/ → [].
 *     • Never throws.
 *     • Read-only (no fs.write*).
 *
 * Regression anchors (real bugs in .pandacorp/comms/progress.md):
 *   B1' (2026-06-16 tokens.ts): NaN slips through `typeof n === "number"`.
 *     Discovery counts must be finite integers; result.length must never be NaN.
 *   I2 (2026-06-16 tokens.ts): empty collection satisfies guards vacuously.
 *     An FRD dir whose work-orders/ has zero wo-*.md files must return no items,
 *     not a vacuously-truthy item.
 *   I3 (2026-06-16 tokens.ts): array-shaped objects fool typeof.
 *     The return of listWorkOrders must be a genuine JS Array.
 *   WO-17-001 parseProjects phantom-slug (2026-06-16 memory.ts): ambiguous
 *     text in a source field produced phantom projects. Here the parallel is
 *     the `frd` field: it must equal the exact directory name — no substring
 *     trimming, no phantom slugs from sub-path components.
 *   WO-16-001 (2026-06-16 orphans.ts): excluding non-matching directories.
 *     dirs not matching frd-\d must be excluded from discovery.
 *   WO-15-001 SHA-hygiene (2026-06-16 plugin-sync.ts): whitespace in string
 *     fields causes false inequality. WorkOrder string fields (id, frd, title,
 *     relPath) must not carry leading/trailing whitespace.
 *
 * Fixture layout (tests/fixtures/wo-05-001/):
 *   docs/frds/
 *     frd-01-alpha/work-orders/wo-01-001-reader.md   (Status: todo)
 *     frd-01-alpha/work-orders/wo-01-002-writer.md   (Status: in_progress)
 *     frd-02-beta/work-orders/wo-02-001-api.md       (Status: review,  has summary)
 *     frd-02-beta/work-orders/wo-02-002-ui.md        (Status: done)
 *     frd-03-gamma/work-orders/wo-03-001-blocked.md  (Status: fail)
 *     frd-03-gamma/work-orders/wo-03-002-unparseable.md (no status field → todo)
 *     frd-04-no-work-orders/frd.md                   (no work-orders/ dir → 0 items)
 *     frd-05-markers/work-orders/wo-05-001-uppercase-done.md     (Status: DONE)
 *     frd-05-markers/work-orders/wo-05-002-uppercase-blocked.md  (Status: BLOCKED)
 *     frd-05-markers/work-orders/wo-05-003-bold-status.md        (**Status:** done)
 *     frd-05-markers/work-orders/wo-05-004-in-progress-uppercase.md (Status: IN_PROGRESS)
 *     not-a-frd-dir/some-file.md                     (excluded — no frd-\d prefix)
 *
 * Stack: Vitest (TS), Node environment, no mocks — real fs reads against
 *         fixture trees + temp dirs. No network calls, no external state.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listWorkOrders } from "../work-orders";

// ---------------------------------------------------------------------------
// Local type mirrors — copied from blueprint §2 IF-05-work-orders.
// Kept here so the RED-phase tests compile without depending on the production
// types (which do not exist yet).
// ---------------------------------------------------------------------------
type WorkOrderState = "todo" | "in_progress" | "review" | "done" | "fail";
interface WorkOrder {
  id: string;
  title: string;
  frd: string;
  state: WorkOrderState;
  relPath: string;
  summary?: string;
}

// ---------------------------------------------------------------------------
// Typed wrapper (RED-phase shim)
// In the RED phase, listWorkOrders does not exist in work-orders.ts yet.
// The cast allows TypeScript to compile so tests can be run and fail red
// without import-level errors. Remove the cast in the GREEN phase.
// ---------------------------------------------------------------------------
function list(projectPath: string): WorkOrder[] {
  return (listWorkOrders as (p: string) => WorkOrder[])(projectPath);
}

// ---------------------------------------------------------------------------
// Fixture paths
// ---------------------------------------------------------------------------
const FIXTURE_DIR = path.resolve(import.meta.dirname, "../../../tests/fixtures/wo-05-001");

// ---------------------------------------------------------------------------
// Temp-dir helpers (isolated from fixture tree)
// ---------------------------------------------------------------------------
let tmpDir: string | null = null;

function makeTempProject(setup?: (root: string) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-wo05001-"));
  if (setup) setup(dir);
  tmpDir = dir;
  return dir;
}

beforeEach(() => {
  tmpDir = null;
});

afterEach(() => {
  if (tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = null;
  }
});

// ---------------------------------------------------------------------------
// AC-05-002.1 — Discovery: every work order carries its parent FRD slug
// Traceability: REQ-05-002, AC-05-002.1
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-002.1 — EACH work order SHALL carry its parent FRD slug", () => {
  it("frd-05: AC-05-002.1 — WHEN listing the fixture project THEN every WorkOrder has a non-empty frd field", () => {
    const orders = list(FIXTURE_DIR);
    expect(orders.length).toBeGreaterThan(0);
    for (const wo of orders) {
      expect(typeof wo.frd).toBe("string");
      expect(wo.frd.length).toBeGreaterThan(0);
    }
  });

  it("frd-05: AC-05-002.1 — WHEN listing the fixture project THEN work orders from frd-01-alpha have frd='frd-01-alpha'", () => {
    const orders = list(FIXTURE_DIR);
    const alpha = orders.filter(
      (o) => o.id.startsWith("WO-01") || o.relPath.includes("frd-01-alpha"),
    );
    expect(alpha.length).toBeGreaterThan(0);
    for (const wo of alpha) {
      expect(wo.frd).toBe("frd-01-alpha");
    }
  });

  it("frd-05: AC-05-002.1 — WHEN listing the fixture project THEN work orders from frd-02-beta have frd='frd-02-beta'", () => {
    const orders = list(FIXTURE_DIR);
    const beta = orders.filter((o) => o.relPath.includes("frd-02-beta"));
    expect(beta.length).toBeGreaterThan(0);
    for (const wo of beta) {
      expect(wo.frd).toBe("frd-02-beta");
    }
  });

  it("frd-05: AC-05-002.1 — WHEN listing the fixture project THEN work orders from frd-03-gamma have frd='frd-03-gamma'", () => {
    const orders = list(FIXTURE_DIR);
    const gamma = orders.filter((o) => o.relPath.includes("frd-03-gamma"));
    expect(gamma.length).toBeGreaterThan(0);
    for (const wo of gamma) {
      expect(wo.frd).toBe("frd-03-gamma");
    }
  });

  it("frd-05: AC-05-002.1 — WHEN project has two FRDs with work-orders THEN all distinct FRD slugs appear in the results", () => {
    const orders = list(FIXTURE_DIR);
    const slugs = new Set(orders.map((o) => o.frd));
    expect(slugs.has("frd-01-alpha")).toBe(true);
    expect(slugs.has("frd-02-beta")).toBe(true);
  });

  it("frd-05: AC-05-002.1 — frd field must equal the exact dir name, not a substring (phantom-slug regression WO-17-001)", () => {
    const orders = list(FIXTURE_DIR);
    // No frd field must be "alpha", "beta", "01", etc. — must be the full slug
    for (const wo of orders) {
      expect(wo.frd).toMatch(/^frd-\d/);
    }
  });
});

// ---------------------------------------------------------------------------
// State derivation — all five WorkOrderState values
// Traceability: WO-05-001 §Scope "Derive WorkOrderState"
// ---------------------------------------------------------------------------

describe("frd-05: state derivation — maps on-disk marker to WorkOrderState", () => {
  it("frd-05: WHEN Status is 'todo' (lowercase) THEN state='todo'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-01-001-reader"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("todo");
  });

  it("frd-05: WHEN Status is 'in_progress' (lowercase) THEN state='in_progress'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-01-002-writer"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("in_progress");
  });

  it("frd-05: WHEN Status is 'review' (lowercase) THEN state='review'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-02-001-api"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("review");
  });

  it("frd-05: WHEN Status is 'done' (lowercase) THEN state='done'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-02-002-ui"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("done");
  });

  it("frd-05: WHEN Status is 'fail' (lowercase) THEN state='fail'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-03-001-blocked"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("fail");
  });

  it("frd-05: WHEN Status is 'DONE' (uppercase) THEN state='done' (case-insensitive derivation)", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-05-001-uppercase-done"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("done");
  });

  it("frd-05: WHEN Status is 'BLOCKED' (uppercase) THEN state='fail' (BLOCKED maps to fail)", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-05-002-uppercase-blocked"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("fail");
  });

  it("frd-05: WHEN Status is 'IN_PROGRESS' (uppercase) THEN state='in_progress'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-05-004-in-progress-uppercase"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("in_progress");
  });

  it("frd-05: WHEN status marker uses bold inline format (**Status:** done) THEN state='done'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-05-003-bold-status"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("done");
  });

  it("frd-05: state is one of the five valid WorkOrderState values for every discovered WO", () => {
    const valid = new Set<WorkOrderState>(["todo", "in_progress", "review", "done", "fail"]);
    const orders = list(FIXTURE_DIR);
    expect(orders.length).toBeGreaterThan(0);
    for (const wo of orders) {
      expect(valid.has(wo.state)).toBe(true);
    }
  });

  it("frd-05: WHEN status marker is written into a temp file THEN the derived state is correct (round-trip)", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-example.md"),
        "# WO-01-001\n\n## Status: review\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("review");
  });
});

// ---------------------------------------------------------------------------
// AC-05-005.1 — Partial tolerance: unparseable WO → "todo", no throw
// Traceability: AC-05-005.1 "state comes from files"; WO-05-001 §Scope "partial-tolerant"
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-005.1 — partial-tolerant: unparseable WO defaults to 'todo'", () => {
  it("frd-05: WHEN a wo-*.md has no Status field THEN state defaults to 'todo'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-03-002-unparseable"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("todo");
  });

  it("frd-05: WHEN a wo-*.md has no Status field THEN listWorkOrders does NOT throw", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-x", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-garbage.md"),
        "# Random content\nno status here",
      );
    });
    expect(() => list(dir)).not.toThrow();
  });

  it("frd-05: WHEN a wo-*.md is an empty file THEN state defaults to 'todo' and no throw", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-x", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(path.join(woDir, "wo-01-001-empty.md"), "");
    });
    expect(() => list(dir)).not.toThrow();
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("todo");
  });

  it("frd-05: WHEN a wo-*.md has a completely unknown status value THEN state defaults to 'todo'", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-x", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-unknown.md"),
        "# WO-01-001\n\n## Status: XYZZY_UNKNOWN\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("todo");
  });

  it("frd-05: WHEN any wo-*.md is malformed THEN the other valid work orders are still returned", () => {
    const orders = list(FIXTURE_DIR);
    // wo-03-002-unparseable.md is malformed; wo-03-001-blocked.md is well-formed
    const valid = orders.find((o) => o.relPath.includes("wo-03-001-blocked"));
    const invalid = orders.find((o) => o.relPath.includes("wo-03-002-unparseable"));
    expect(valid).toBeDefined();
    expect(invalid).toBeDefined(); // still present, not dropped
  });
});

// ---------------------------------------------------------------------------
// Absent work-orders/ → [] (edge case from WO-05-001 §Scope)
// Traceability: WO-05-001 §Scope "absent work-orders/ → []"
// ---------------------------------------------------------------------------

describe("frd-05: absent work-orders/ dir → empty array for that FRD", () => {
  it("frd-05: WHEN an FRD dir has no work-orders/ sub-dir THEN it contributes 0 items", () => {
    const orders = list(FIXTURE_DIR);
    // frd-04-no-work-orders has only a frd.md, no work-orders/ dir
    const fromFrd04 = orders.filter((o) => o.frd === "frd-04-no-work-orders");
    expect(fromFrd04).toHaveLength(0);
  });

  it("frd-05: WHEN the entire docs/frds/ dir is absent THEN listWorkOrders returns []", () => {
    const dir = makeTempProject();
    const orders = list(dir);
    expect(Array.isArray(orders)).toBe(true);
    expect(orders).toHaveLength(0);
  });

  it("frd-05: WHEN work-orders/ dir exists but contains no wo-*.md files THEN it contributes 0 items", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-empty", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      // no wo-*.md files — only a README
      fs.writeFileSync(path.join(woDir, "README.md"), "# Work orders\nNone yet.\n");
    });
    const orders = list(dir);
    expect(orders).toHaveLength(0);
  });

  it("frd-05: WHEN work-orders/ dir exists but contains only non-matching filenames THEN it contributes 0 items", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-x", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(path.join(woDir, "draft.md"), "# Draft\n");
      fs.writeFileSync(path.join(woDir, "notes.txt"), "some notes\n");
    });
    const orders = list(dir);
    expect(orders).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Discovery breadth: all FRDs are scanned, non-FRD dirs are excluded
// Traceability: WO-05-001 §Scope "docs/frds/frd-*/work-orders/wo-*.md"
// ---------------------------------------------------------------------------

describe("frd-05: discovery breadth — scans all frd-* dirs, ignores non-matching dirs", () => {
  it("frd-05: WHEN the fixture has 3 FRDs with work-orders THEN all 3 feature slugs appear in results", () => {
    const orders = list(FIXTURE_DIR);
    const slugs = new Set(orders.map((o) => o.frd));
    expect(slugs.has("frd-01-alpha")).toBe(true);
    expect(slugs.has("frd-02-beta")).toBe(true);
    expect(slugs.has("frd-03-gamma")).toBe(true);
  });

  it("frd-05: WHEN a dir named 'not-a-frd-dir' exists in docs/frds/ THEN no work orders from it appear", () => {
    const orders = list(FIXTURE_DIR);
    const bad = orders.filter((o) => o.frd === "not-a-frd-dir");
    expect(bad).toHaveLength(0);
  });

  it("frd-05: WHEN 2 FRDs have work-orders with 2 files each THEN exactly 4 items from those two FRDs are returned", () => {
    const orders = list(FIXTURE_DIR);
    const from12 = orders.filter((o) => o.frd === "frd-01-alpha" || o.frd === "frd-02-beta");
    expect(from12).toHaveLength(4);
  });

  it("frd-05: WHEN a temp project has two FRDs with 3 WOs total THEN result.length is 3", () => {
    const dir = makeTempProject((root) => {
      const makeWo = (slug: string, name: string, status: string) => {
        const woDir = path.join(root, "docs", "frds", slug, "work-orders");
        fs.mkdirSync(woDir, { recursive: true });
        fs.writeFileSync(path.join(woDir, `${name}.md`), `# ${name}\n\n## Status: ${status}\n`);
      };
      makeWo("frd-01-x", "wo-01-001-a", "todo");
      makeWo("frd-01-x", "wo-01-002-b", "done");
      makeWo("frd-02-y", "wo-02-001-c", "review");
    });
    const orders = list(dir);
    expect(orders).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// WorkOrder shape invariants
// Traceability: IF-05-work-orders blueprint §2
// ---------------------------------------------------------------------------

describe("frd-05: WorkOrder shape invariants", () => {
  it("frd-05: WHEN listing the fixture project THEN every WorkOrder has non-empty string id, title, frd, state, relPath", () => {
    const orders = list(FIXTURE_DIR);
    expect(orders.length).toBeGreaterThan(0);
    for (const wo of orders) {
      expect(typeof wo.id).toBe("string");
      expect(wo.id.length).toBeGreaterThan(0);
      expect(typeof wo.title).toBe("string");
      expect(wo.title.length).toBeGreaterThan(0);
      expect(typeof wo.frd).toBe("string");
      expect(wo.frd.length).toBeGreaterThan(0);
      expect(typeof wo.state).toBe("string");
      expect(wo.state.length).toBeGreaterThan(0);
      expect(typeof wo.relPath).toBe("string");
      expect(wo.relPath.length).toBeGreaterThan(0);
    }
  });

  it("frd-05: WHEN listing the fixture project THEN all WorkOrder ids are unique", () => {
    const orders = list(FIXTURE_DIR);
    const ids = orders.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("frd-05: WHEN listing the fixture project THEN all WorkOrder relPaths use forward slashes (no backslashes)", () => {
    const orders = list(FIXTURE_DIR);
    for (const wo of orders) {
      expect(wo.relPath).not.toContain("\\");
    }
  });

  it("frd-05: WHEN listing the fixture project THEN no WorkOrder relPath is absolute", () => {
    const orders = list(FIXTURE_DIR);
    for (const wo of orders) {
      expect(path.isAbsolute(wo.relPath)).toBe(false);
    }
  });

  it("frd-05: WHEN listing the fixture project THEN no WorkOrder relPath starts with '../'", () => {
    const orders = list(FIXTURE_DIR);
    for (const wo of orders) {
      expect(wo.relPath.startsWith("../")).toBe(false);
    }
  });

  it("frd-05: WHEN listing the fixture project THEN the result is a genuine JS Array (regression I3)", () => {
    const result = list(FIXTURE_DIR);
    expect(Array.isArray(result)).toBe(true);
  });

  it("frd-05: WHEN listing the fixture project THEN result.length is a finite integer, never NaN (regression B1')", () => {
    const result = list(FIXTURE_DIR);
    expect(Number.isFinite(result.length)).toBe(true);
    expect(Number.isInteger(result.length)).toBe(true);
  });

  it("frd-05: summary field is undefined or a non-empty string — never null or empty string", () => {
    const orders = list(FIXTURE_DIR);
    for (const wo of orders) {
      if (wo.summary !== undefined) {
        expect(typeof wo.summary).toBe("string");
        expect(wo.summary.length).toBeGreaterThan(0);
      }
    }
  });

  it("frd-05: WHEN a WO has a Summary section THEN summary field is populated (wo-02-001-api.md)", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-02-001-api"));
    expect(wo).toBeDefined();
    // wo-02-001-api.md has a ## Summary section
    expect(wo?.summary).toBeDefined();
    expect(typeof wo?.summary).toBe("string");
  });

  it("frd-05: WorkOrder string fields carry no leading or trailing whitespace (regression WO-15-001 SHA-hygiene)", () => {
    const orders = list(FIXTURE_DIR);
    for (const wo of orders) {
      expect(wo.id).toBe(wo.id.trim());
      expect(wo.frd).toBe(wo.frd.trim());
      expect(wo.title).toBe(wo.title.trim());
      expect(wo.relPath).toBe(wo.relPath.trim());
    }
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant (AC-05-005.1)
// Traceability: AC-05-005.1 "state comes from files written by agents" (no writes)
// WO-05-001 §Scope "Read-only (no fs.write*)"
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-005.1 — read-only invariant: listWorkOrders never writes", () => {
  it("frd-05: WHEN listWorkOrders is called THEN no file in the project tree is modified (mtime unchanged)", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-x", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(path.join(woDir, "wo-01-001-reader.md"), "# WO\n\n## Status: todo\n");
    });
    const woFile = path.join(dir, "docs", "frds", "frd-01-x", "work-orders", "wo-01-001-reader.md");
    const before = fs.statSync(woFile);
    list(dir);
    list(dir); // call twice to test idempotency of the read-only invariant
    const after = fs.statSync(woFile);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  });

  it("frd-05: WHEN listWorkOrders is called on a non-existent path THEN no file or directory is created", () => {
    const ghostPath = "/tmp/pandacorp-wo05001-ghost-readonly-probe";
    if (fs.existsSync(ghostPath)) {
      fs.rmSync(ghostPath, { recursive: true, force: true });
    }
    list(ghostPath);
    expect(fs.existsSync(ghostPath)).toBe(false);
  });

  it("frd-05: WHEN listWorkOrders runs THEN the directory tree snapshot is identical before and after two calls", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-x", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(path.join(woDir, "wo-01-001-reader.md"), "# WO\n\n## Status: todo\n");
    });
    const snapshot = (p: string): string[] =>
      (fs.readdirSync(p, { recursive: true }) as string[]).slice().sort();
    const before = snapshot(dir);
    list(dir);
    list(dir);
    const after = snapshot(dir);
    expect(after).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Never-throws invariant
// Traceability: WO-05-001 §Scope "Never throws"
// ---------------------------------------------------------------------------

describe("frd-05: never-throws invariant", () => {
  it("frd-05: WHEN projectPath does not exist THEN listWorkOrders does NOT throw", () => {
    expect(() => list("/nonexistent/project/path/wo05001-probe")).not.toThrow();
  });

  it("frd-05: WHEN projectPath does not exist THEN listWorkOrders returns []", () => {
    const result = list("/nonexistent/project/path/wo05001-probe");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("frd-05: WHEN projectPath is an empty string THEN listWorkOrders does NOT throw", () => {
    expect(() => list("")).not.toThrow();
  });

  it("frd-05: WHEN projectPath is an empty string THEN listWorkOrders returns []", () => {
    const result = list("");
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it("frd-05: WHEN docs/frds/ exists but all work-orders/ dirs are empty THEN returns [] without throwing", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "frds", "frd-01-x", "work-orders"), { recursive: true });
    });
    expect(() => list(dir)).not.toThrow();
    expect(list(dir)).toHaveLength(0);
  });

  it("frd-05: WHEN a wo-*.md is completely empty THEN listWorkOrders does NOT throw", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-x", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(path.join(woDir, "wo-01-001-empty.md"), "");
    });
    expect(() => list(dir)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Idempotency: calling listWorkOrders twice must return the same results
// Traceability: architectural §7 "partial-tolerance ... never breaks aggregation"
// ---------------------------------------------------------------------------

describe("frd-05: idempotency — calling twice returns identical results", () => {
  it("frd-05: WHEN listWorkOrders is called twice on the same project THEN the results are deeply equal", () => {
    const first = list(FIXTURE_DIR);
    const second = list(FIXTURE_DIR);
    expect(second).toEqual(first);
  });
});

// ---------------------------------------------------------------------------
// Serializability — WorkOrder[] must survive a JSON round-trip
// (results are passed to Server Components / client boundary)
// ---------------------------------------------------------------------------

describe("frd-05: serializability — WorkOrder[] survives JSON round-trip", () => {
  it("frd-05: WHEN the result of listWorkOrders is JSON.stringified and parsed THEN it equals the original", () => {
    const orders = list(FIXTURE_DIR);
    const round = JSON.parse(JSON.stringify(orders)) as unknown;
    expect(round).toEqual(orders);
    expect(Array.isArray(round)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// relPath correctness — must point to the actual on-disk file, relative to
// project root, using forward slashes (needed by readDoc in FRD-04)
// ---------------------------------------------------------------------------

describe("frd-05: relPath correctness — points to the actual wo-*.md file", () => {
  it("frd-05: WHEN listing the fixture project THEN every relPath exists on disk as a file", () => {
    const orders = list(FIXTURE_DIR);
    for (const wo of orders) {
      const abs = path.join(FIXTURE_DIR, wo.relPath.replace(/\//g, path.sep));
      expect(fs.existsSync(abs)).toBe(true);
    }
  });

  it("frd-05: WHEN listing the fixture project THEN relPath follows docs/frds/<frd>/work-orders/wo-*.md pattern", () => {
    const orders = list(FIXTURE_DIR);
    for (const wo of orders) {
      expect(wo.relPath).toMatch(/^docs\/frds\/frd-\d[^/]*\/work-orders\/wo-[^/]+\.md$/);
    }
  });

  it("frd-05: WHEN relPath is used to compute frd slug THEN it matches the frd field", () => {
    const orders = list(FIXTURE_DIR);
    for (const wo of orders) {
      // relPath = "docs/frds/<frd>/work-orders/wo-*.md"
      const parts = wo.relPath.split("/");
      const frdFromPath = parts[2]; // index 2 is the frd-NN-slug segment
      expect(frdFromPath).toBe(wo.frd);
    }
  });
});

// ---------------------------------------------------------------------------
// AC-05-006.1 — Project with no work orders at all → empty result
// Traceability: AC-05-006.1 "WHEN a project has no work orders, the view SHALL
// show a message that they are generated in /pandacorp:architecture"
// (the lib layer returns []; the UI layer CMP-05-empty renders the message)
// ---------------------------------------------------------------------------

describe("frd-05: AC-05-006.1 — project with no work orders → [] (empty data layer)", () => {
  it("frd-05: AC-05-006.1 — WHEN the project has no docs/frds/ dir THEN result is []", () => {
    const dir = makeTempProject();
    expect(list(dir)).toEqual([]);
  });

  it("frd-05: AC-05-006.1 — WHEN the project has docs/frds/ but all FRDs lack work-orders/ THEN result is []", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "frds", "frd-01-x"), { recursive: true });
      fs.writeFileSync(path.join(root, "docs", "frds", "frd-01-x", "frd.md"), "# FRD-01\n");
    });
    expect(list(dir)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// DR-050 — frontmatter `implementation_status` support
//
// New behaviour (added in the frontmatter-reader work):
//   1. If the WO file has frontmatter `implementation_status` → that is the
//      source of truth. DR-050 values: PLANNED | IN_PROGRESS | IN_REVIEW |
//      VERIFIED | BLOCKED.  Mapping:
//        PLANNED    → "todo"
//        IN_PROGRESS → "in_progress"
//        IN_REVIEW   → "review"
//        VERIFIED    → "done"
//        BLOCKED     → "fail"
//   2. If no frontmatter `implementation_status` → fall back to the legacy
//      ## Status: body marker (retrocompat).
//   3. Frontmatter wins when BOTH are present (precedence rule).
//   4. WO with no frontmatter AND no body Status → "todo" (existing default).
//
// Fixtures live in tests/fixtures/wo-05-001/docs/frds/frd-06-frontmatter/.
// ---------------------------------------------------------------------------

describe("frd-05: DR-050 frontmatter implementation_status — new values map correctly", () => {
  it("frd-05: WHEN frontmatter implementation_status is 'PLANNED' THEN state='todo'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-06-001-fm-planned"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("todo");
  });

  it("frd-05: WHEN frontmatter implementation_status is 'IN_PROGRESS' THEN state='in_progress'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-06-002-fm-in-progress"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("in_progress");
  });

  it("frd-05: WHEN frontmatter implementation_status is 'IN_REVIEW' THEN state='review'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-06-003-fm-in-review"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("review");
  });

  it("frd-05: WHEN frontmatter implementation_status is 'VERIFIED' THEN state='done'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-06-004-fm-verified"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("done");
  });

  it("frd-05: WHEN frontmatter implementation_status is 'BLOCKED' THEN state='fail'", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-06-005-fm-blocked"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("fail");
  });

  it("frd-05: WHEN frontmatter implementation_status is present via temp file (round-trip)", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-example.md"),
        "---\nid: WO-01-001\nimplementation_status: VERIFIED\n---\n# WO-01-001\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("done");
  });

  it("frd-05: WHEN frontmatter implementation_status is unknown value THEN state defaults to 'todo'", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-unknown.md"),
        "---\nimplementation_status: XYZZY_UNKNOWN\n---\n# WO-01-001\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("todo");
  });
});

describe("frd-05: DR-050 frontmatter precedence over legacy body Status", () => {
  it("frd-05: WHEN both frontmatter implementation_status AND body ## Status exist THEN frontmatter wins", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-06-006-fm-precedence"));
    expect(wo).toBeDefined();
    // Frontmatter: VERIFIED → "done". Body says "todo". Frontmatter must win.
    expect(wo?.state).toBe("done");
  });

  it("frd-05: WHEN frontmatter says BLOCKED and body says done THEN frontmatter (BLOCKED→fail) wins", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-prec.md"),
        "---\nimplementation_status: BLOCKED\n---\n# WO-01-001\n\n## Status: done\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("fail");
  });

  it("frd-05: WHEN frontmatter says IN_PROGRESS and body says done THEN frontmatter wins", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-prec2.md"),
        "---\nimplementation_status: IN_PROGRESS\n---\n# WO-01-001\n\n## Status: done\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("in_progress");
  });
});

describe("frd-05: DR-050 legacy retrocompat — no frontmatter falls back to ## Status body", () => {
  it("frd-05: WHEN no frontmatter AND body has '## Status: review' THEN state='review' (legacy retrocompat)", () => {
    const orders = list(FIXTURE_DIR);
    const wo = orders.find((o) => o.relPath.includes("wo-06-007-legacy-no-fm"));
    expect(wo).toBeDefined();
    expect(wo?.state).toBe("review");
  });

  it("frd-05: WHEN frontmatter exists but has NO implementation_status key THEN falls back to body Status", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-no-impl-status.md"),
        "---\nid: WO-01-001\ntitle: Example\n---\n# WO-01-001\n\n## Status: review\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("review");
  });

  it("frd-05: WHEN frontmatter has implementation_status: null THEN falls back to body Status", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-null-impl.md"),
        "---\nimplementation_status: null\n---\n# WO-01-001\n\n## Status: done\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("done");
  });

  it("frd-05: WHEN no frontmatter AND no body Status THEN state defaults to 'todo' (unchanged)", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-none.md"),
        "# WO-01-001\n\nNo status anywhere.\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("todo");
  });
});

describe("frd-05: DR-050 frontmatter robustness — malformed YAML is tolerated", () => {
  it("frd-05: WHEN frontmatter YAML is malformed THEN falls back to body Status (no throw)", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      // Malformed YAML: unmatched colon, no closing ---
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-bad-yaml.md"),
        "---\n: this is not valid yaml\n---\n# WO-01-001\n\n## Status: review\n",
      );
    });
    expect(() => list(dir)).not.toThrow();
  });

  it("frd-05: WHEN frontmatter block is completely empty THEN falls back to body Status", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-empty-fm.md"),
        "---\n---\n# WO-01-001\n\n## Status: done\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("done");
  });

  it("frd-05: WHEN file has only frontmatter and no body THEN state comes from frontmatter, no throw", () => {
    const dir = makeTempProject((root) => {
      const woDir = path.join(root, "docs", "frds", "frd-01-test", "work-orders");
      fs.mkdirSync(woDir, { recursive: true });
      fs.writeFileSync(
        path.join(woDir, "wo-01-001-fm-only.md"),
        "---\nimplementation_status: VERIFIED\n---\n",
      );
    });
    const orders = list(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("done");
  });
});
