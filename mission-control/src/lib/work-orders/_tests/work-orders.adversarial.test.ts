/**
 * WO-05-001 REVIEW — adversarial tests (DR-015).
 *
 * Written by the reviewer (a DIFFERENT model from the implementer) to probe
 * edge cases, abuse and real-bug parallels the implementer's own suite did NOT
 * cover. Test-files only; no production code is touched.
 *
 * Focus areas the GREEN suite missed:
 *   A. aggregateProgress() ships in lib/work-orders.ts but has ZERO tests in
 *      work-orders.test.ts. The DoD claims pct is "rounded to 1 decimal".
 *      Adversarial: verify the contract, including division-by-zero and the
 *      done-counting semantics (only state==="done").
 *   B. STATUS_RE takes the FIRST "Status:"-like match in the whole file. Real
 *      WO files routinely contain prose mentioning the word before the canonical
 *      "## Status:" marker (e.g. a "Definition of done" checklist, or "Status
 *      of the kanban"). A greedy first-match can pick up the wrong token.
 *   C. The regex is run against the RAW content with no anchoring to a heading
 *      line, so an inline "Status:" inside body prose can shadow the real one.
 *   D. Title-derived id: the H1 may not contain WO-NN-MMM; ensure the filename
 *      fallback fires and the id is well-formed.
 *   E. Producer convention parity: the actual /pandacorp:implement marker is
 *      "## Status: <state>" on its own line; confirm a realistic WO file shaped
 *      like the real wo-05-001-*.md (checklist + "## Status: done") resolves to
 *      "done", not to a stray earlier token.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { aggregateProgress, listWorkOrders, type WorkOrder } from "../work-orders";

let tmpDir: string | null = null;
function makeTempProject(setup?: (root: string) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-wo05001-adv-"));
  if (setup) setup(dir);
  tmpDir = dir;
  return dir;
}
function writeWo(root: string, slug: string, name: string, body: string): void {
  const woDir = path.join(root, "docs", "frds", slug, "work-orders");
  fs.mkdirSync(woDir, { recursive: true });
  fs.writeFileSync(path.join(woDir, `${name}.md`), body);
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
// A. aggregateProgress — entirely untested by the GREEN suite
// ---------------------------------------------------------------------------
describe("WO-05-001 adversarial: aggregateProgress contract", () => {
  const wo = (state: WorkOrder["state"]): WorkOrder => ({
    id: "WO-01-001",
    title: "t",
    frd: "frd-01-x",
    state,
    relPath: "docs/frds/frd-01-x/work-orders/wo-01-001.md",
  });

  it("empty list → {done:0,total:0,pct:0}, never NaN (division-by-zero guard)", () => {
    const p = aggregateProgress([]);
    expect(p).toEqual({ done: 0, total: 0, pct: 0 });
    expect(Number.isNaN(p.pct)).toBe(false);
  });

  it("counts ONLY state==='done' toward done (review/fail/in_progress excluded)", () => {
    const p = aggregateProgress([
      wo("done"),
      wo("done"),
      wo("review"),
      wo("fail"),
      wo("in_progress"),
      wo("todo"),
    ]);
    expect(p.done).toBe(2);
    expect(p.total).toBe(6);
  });

  it("pct is rounded to 1 decimal place (DoD claim): 1/3 → 33.3", () => {
    const p = aggregateProgress([wo("done"), wo("todo"), wo("todo")]);
    expect(p.pct).toBe(33.3);
  });

  it("pct for 2/3 → 66.7 (rounds up at the 1-decimal boundary)", () => {
    const p = aggregateProgress([wo("done"), wo("done"), wo("todo")]);
    expect(p.pct).toBe(66.7);
  });

  it("all done → pct exactly 100, all todo → pct exactly 0", () => {
    expect(aggregateProgress([wo("done"), wo("done")]).pct).toBe(100);
    expect(aggregateProgress([wo("todo"), wo("todo")]).pct).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B/C. First-"Status:"-match shadowing — the highest-risk real-world bug.
// A genuine /pandacorp:implement WO file has its canonical "## Status: done"
// at the BOTTOM, after a "Definition of done" checklist. If earlier prose
// contains a "Status"-like token, the greedy first-match picks it up.
// ---------------------------------------------------------------------------
describe("WO-05-001 adversarial: canonical '## Status:' must win over earlier prose", () => {
  it("realistic WO (checklist + trailing '## Status: done') resolves to 'done'", () => {
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-05-real",
        "wo-05-001-real",
        [
          "# WO-05-001 — reader",
          "",
          "## Definition of done",
          "- [x] Tests written first and green for all cases.",
          "- [x] No any; read-only.",
          "",
          "## Status: done",
          "",
          "### Evidence",
          "All green.",
        ].join("\n"),
      );
    });
    const orders = listWorkOrders(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("done");
  });

  it("body prose mentioning 'Status: blocked' BEFORE the real '## Status: done' must NOT shadow it", () => {
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-05-shadow",
        "wo-05-001-shadow",
        [
          "# WO-05-001 — reader",
          "",
          "## Notes",
          "Earlier the Status: blocked situation was discussed, now resolved.",
          "",
          "## Status: done",
        ].join("\n"),
      );
    });
    const orders = listWorkOrders(dir);
    expect(orders).toHaveLength(1);
    // The canonical marker is 'done'. If this fails, the greedy first-match is
    // grabbing the prose 'blocked' (→ fail), which is the bug.
    expect(orders[0]?.state).toBe("done");
  });

  // Exact shape of the REAL misparses found in this repo (WO-01-003, WO-01-005):
  // prose like `type IdeaStatus = ...` or `(title, status, ...)` appears before
  // the canonical `## Status: DONE`, and the greedy regex grabs the prose token,
  // normalising the WO to 'todo' even though the agent marked it done.
  it("real-repo shape: 'type IdeaStatus = ...' prose before '## Status: DONE' must resolve to done", () => {
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-01-data-reading",
        "wo-01-003-read-ideas",
        [
          "# WO-01-003 — readIdeas",
          "",
          "## Scope",
          "Each returned card exposes its frontmatter:",
          "  slug: string; title: string; status: IdeaStatus;",
          "",
          "## Status: DONE",
        ].join("\n"),
      );
    });
    const orders = listWorkOrders(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("done");
  });

  it("real-repo shape: 'with their frontmatter (title, status, ...)' prose before '## Status: DONE' must resolve to done", () => {
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-01-data-reading",
        "wo-01-005-read-status",
        [
          "# WO-01-005 — readStatus",
          "",
          "## Scope",
          "List the cards (ignoring `_idea-template.md` and `decision-log.md`) with",
          "their frontmatter (title, status, projectType, returnType, score, body).",
          "",
          "## Status: DONE",
        ].join("\n"),
      );
    });
    const orders = listWorkOrders(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.state).toBe("done");
  });
});

// ---------------------------------------------------------------------------
// D. id derivation when the H1 lacks a WO-NN-MMM token
// ---------------------------------------------------------------------------
describe("WO-05-001 adversarial: id falls back to filename when H1 has no WO id", () => {
  it("H1 without a WO id → id derived from filename (WO-07-042)", () => {
    const dir = makeTempProject((root) => {
      writeWo(root, "frd-07-x", "wo-07-042-thing", "# Just a friendly title\n\n## Status: todo\n");
    });
    const orders = listWorkOrders(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.id).toBe("WO-07-042");
  });

  it("no H1 at all → title falls back to filename stem, id still derived from filename", () => {
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-08-x",
        "wo-08-009-nohead",
        "Some body text, no heading.\n\n## Status: review\n",
      );
    });
    const orders = listWorkOrders(dir);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.id).toBe("WO-08-009");
    expect(orders[0]?.title.length).toBeGreaterThan(0);
    expect(orders[0]?.state).toBe("review");
  });
});

// ---------------------------------------------------------------------------
// E. Abuse / robustness inputs the suite did not cover
// ---------------------------------------------------------------------------
describe("WO-05-001 adversarial: abuse inputs are tolerated, never throw", () => {
  it("a WO file that is a huge binary-ish blob does not throw and defaults to todo", () => {
    const dir = makeTempProject((root) => {
      const blob = `# WO-09-001\n${" � garbage ".repeat(5000)}`;
      writeWo(root, "frd-09-x", "wo-09-001-blob", blob);
    });
    expect(() => listWorkOrders(dir)).not.toThrow();
    const orders = listWorkOrders(dir);
    expect(orders[0]?.state).toBe("todo");
  });

  it("status value with surrounding whitespace and CRLF line endings still normalises", () => {
    const dir = makeTempProject((root) => {
      writeWo(root, "frd-10-x", "wo-10-001-crlf", "# WO-10-001\r\n\r\n## Status:    DONE   \r\n");
    });
    const orders = listWorkOrders(dir);
    expect(orders[0]?.state).toBe("done");
    // and no whitespace leaks into string fields
    expect(orders[0]?.id).toBe(orders[0]?.id.trim());
  });
});

// ---------------------------------------------------------------------------
// F. DR-050 frontmatter adversarial edge cases
//
// These probe the gray-matter integration at the limits: deeply-nested YAML,
// mixed-case values, numeric frontmatter value that is NOT a string, a WO
// where frontmatter has implementation_status but the body also contains a
// misleading prose "Status:" mention, and the cache-bypass invariant.
// ---------------------------------------------------------------------------
describe("WO-05-001 adversarial: DR-050 frontmatter edge cases", () => {
  it("frontmatter implementation_status with surrounding whitespace in YAML is still parsed (VERIFIED → done)", () => {
    // gray-matter trims YAML string values.
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-11-x",
        "wo-11-001-ws",
        "---\nimplementation_status: '  VERIFIED  '\n---\n# WO-11-001\n",
      );
    });
    const orders = listWorkOrders(dir);
    expect(orders[0]?.state).toBe("done");
  });

  it("frontmatter implementation_status lowercase ('verified') is accepted (case-insensitive)", () => {
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-11-x",
        "wo-11-002-lower",
        "---\nimplementation_status: verified\n---\n# WO-11-002\n",
      );
    });
    const orders = listWorkOrders(dir);
    expect(orders[0]?.state).toBe("done");
  });

  it("frontmatter implementation_status as a YAML integer (not a string) → falls back to body Status", () => {
    // YAML: `implementation_status: 1` parses to number 1, not a string → fall back.
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-11-x",
        "wo-11-003-int",
        "---\nimplementation_status: 1\n---\n# WO-11-003\n\n## Status: review\n",
      );
    });
    const orders = listWorkOrders(dir);
    // frontmatter value is a number → null → fall back to body → "review"
    expect(orders[0]?.state).toBe("review");
  });

  it("frontmatter present with VERIFIED but body has prose 'Status: blocked' → frontmatter still wins", () => {
    // Ensures that the prose-suppression logic for body scanning doesn't interact
    // badly with the frontmatter path.
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-11-x",
        "wo-11-004-prose-body",
        [
          "---",
          "implementation_status: VERIFIED",
          "---",
          "# WO-11-004",
          "",
          "## Notes",
          "Earlier the Status: blocked situation was discussed.",
          "",
          "## Status: todo",
        ].join("\n"),
      );
    });
    const orders = listWorkOrders(dir);
    expect(orders[0]?.state).toBe("done");
  });

  it("calling listWorkOrders twice on the same frontmatter file returns identical results (cache-bypass, gray-matter gotcha)", () => {
    // Regression: gray-matter@4 LRU cache — bypassed by passing { excerpt: false }.
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-11-x",
        "wo-11-005-cache",
        "---\nimplementation_status: IN_REVIEW\n---\n# WO-11-005\n",
      );
    });
    const first = listWorkOrders(dir);
    const second = listWorkOrders(dir);
    expect(first[0]?.state).toBe("review");
    expect(second[0]?.state).toBe("review");
    expect(second).toEqual(first);
  });

  it("frontmatter with only non-status fields does not shadow the body Status", () => {
    const dir = makeTempProject((root) => {
      writeWo(
        root,
        "frd-11-x",
        "wo-11-006-other-fm",
        "---\ntitle: My WO\nid: WO-11-006\n---\n# WO-11-006\n\n## Status: done\n",
      );
    });
    const orders = listWorkOrders(dir);
    expect(orders[0]?.state).toBe("done");
  });
});
