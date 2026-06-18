/**
 * WO-04-002 — ADVERSARIAL review tests (reviewer, opus) — DR-015
 *
 * These probe edge cases, error and abuse paths that the implementer's
 * lib/docs.wo04002.test.ts did NOT cover. Derived from the EARS criteria
 * (AC-04-003.2/.3, REQ-04-003/004) and from how `progress.md` / `decisions.md`
 * are really written by the factory skills (Spanish, hand-edited markdown).
 *
 * Focus areas the original suite missed:
 *   1. CRLF line endings (Windows / mixed) — split("\n") leaves trailing "\r".
 *   2. Alternative markdown bullet styles ("* ", "+ ", "*   " hard tabs).
 *   3. Empty-title decision headings ("## OPEN:") — should not yield a blank title.
 *   4. Recommendation hygiene: multiple rec lines in a block, rec before any
 *      heading, rec must NOT bleed from one block into the next.
 *   5. Heading robustness: "##OPEN:" (no space) must not match; trailing spaces;
 *      lowercase open/closed; H3 (### OPEN:) must NOT be treated as a block.
 *   6. Read-as-is fidelity: inline markdown in entries is preserved verbatim.
 *   7. Read-only / no-leak: a symlinked progress.md is read but never written.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readActivityLog, readDecisions } from "./docs";

type ActivityLog = { entries: string[] };
type DecisionPoint = { title: string; recommendation?: string; resolved: boolean };

const tmpDirs: string[] = [];

function makeTempProject(setup?: (root: string) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-docs-wo04002-rev-"));
  tmpDirs.push(dir);
  if (setup) setup(dir);
  return dir;
}

function writeProgress(root: string, content: string): void {
  fs.mkdirSync(path.join(root, ".pandacorp", "comms"), { recursive: true });
  fs.writeFileSync(path.join(root, ".pandacorp", "comms", "progress.md"), content);
}

function writeDecisions(root: string, content: string): void {
  fs.mkdirSync(path.join(root, ".pandacorp", "inbox"), { recursive: true });
  fs.writeFileSync(path.join(root, ".pandacorp", "inbox", "decisions.md"), content);
}

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) fs.rmSync(d, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 1. CRLF / mixed line endings — the parser must not leak a trailing "\r".
//    Skills run on macOS but the owner may paste Windows-authored text.
// ---------------------------------------------------------------------------

describe("frd-04 [adversarial]: readActivityLog — CRLF line endings", () => {
  it("strips the trailing carriage return from CRLF bullet entries", () => {
    const dir = makeTempProject((root) =>
      writeProgress(root, "# Log\r\n- WO-99 done.\r\n- WO-100 in progress.\r\n"),
    );
    const log = readActivityLog(dir) as ActivityLog;
    expect(log.entries.length).toBeGreaterThanOrEqual(2);
    for (const e of log.entries) {
      expect(e.includes("\r")).toBe(false);
      expect(e.endsWith("\r")).toBe(false);
    }
    expect(log.entries.some((e) => e === "WO-99 done.")).toBe(true);
  });
});

describe("frd-04 [adversarial]: readDecisions — CRLF line endings", () => {
  it("does not leave a trailing carriage return in titles or recommendations", () => {
    const dir = makeTempProject((root) =>
      writeDecisions(
        root,
        "# D\r\n\r\n## OPEN: Pick CRLF safety\r\n- **Recommendation:** Strip the CR.\r\n",
      ),
    );
    const result = readDecisions(dir) as DecisionPoint[];
    expect(result).toHaveLength(1);
    const dp = result[0];
    expect(dp).toBeDefined();
    if (!dp) return;
    expect(dp.title.includes("\r")).toBe(false);
    expect(dp.title).toBe("Pick CRLF safety");
    if (dp.recommendation !== undefined) {
      expect(dp.recommendation.includes("\r")).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Alternative bullet styles. Markdown allows "-", "*" and "+".
//    The original suite only ever tested "- ". The contract says "bullet
//    lines / log items" (WO scope §). Documenting actual behaviour: at minimum
//    the reader must not throw or emit blank entries on "*"/"+" bullets.
// ---------------------------------------------------------------------------

describe("frd-04 [adversarial]: readActivityLog — non-dash bullet styles", () => {
  it("never emits a blank entry regardless of bullet marker (regression I2)", () => {
    const dir = makeTempProject((root) =>
      writeProgress(root, "# Log\n* Star bullet.\n+ Plus bullet.\n- Dash bullet.\n"),
    );
    const log = readActivityLog(dir) as ActivityLog;
    expect(Array.isArray(log.entries)).toBe(true);
    for (const e of log.entries) {
      expect(e.trim().length).toBeGreaterThan(0);
    }
    // The dash bullet is definitely captured.
    expect(log.entries.some((e) => e === "Dash bullet.")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Empty / whitespace-only decision titles must NOT produce a blank-title
//    DecisionPoint (that would render an empty highlighted card in the UI).
// ---------------------------------------------------------------------------

describe("frd-04 [adversarial]: readDecisions — empty title heading", () => {
  it("does not produce a DecisionPoint with an empty title", () => {
    const dir = makeTempProject((root) =>
      writeDecisions(root, "# D\n\n## OPEN:\n- Context: heading with no title text.\n"),
    );
    const result = readDecisions(dir) as DecisionPoint[];
    for (const dp of result) {
      expect(dp.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("does not produce a DecisionPoint when the title is only whitespace", () => {
    const dir = makeTempProject((root) =>
      writeDecisions(root, "# D\n\n## OPEN:    \n- Context: whitespace title.\n"),
    );
    const result = readDecisions(dir) as DecisionPoint[];
    for (const dp of result) {
      expect(dp.title.trim().length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Recommendation hygiene.
// ---------------------------------------------------------------------------

describe("frd-04 [adversarial]: readDecisions — recommendation scoping", () => {
  it("a recommendation in block A does NOT bleed into block B (which has none)", () => {
    const dir = makeTempProject((root) =>
      writeDecisions(
        root,
        [
          "# D",
          "",
          "## OPEN: First",
          "- **Recommendation:** Use option A.",
          "",
          "## OPEN: Second",
          "- Context: no recommendation here.",
        ].join("\n"),
      ),
    );
    const result = readDecisions(dir) as DecisionPoint[];
    const first = result.find((d) => d.title.includes("First"));
    const second = result.find((d) => d.title.includes("Second"));
    expect(first?.recommendation).toBe("Use option A.");
    expect(second?.recommendation).toBeUndefined();
  });

  it("a recommendation line before any heading is ignored (no orphan block)", () => {
    const dir = makeTempProject((root) =>
      writeDecisions(
        root,
        "# D\n- **Recommendation:** orphan, no heading yet.\n\n## OPEN: Real one\n- Context.\n",
      ),
    );
    const result = readDecisions(dir) as DecisionPoint[];
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toContain("Real one");
    expect(result[0]?.recommendation).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Heading robustness.
// ---------------------------------------------------------------------------

describe("frd-04 [adversarial]: readDecisions — heading robustness", () => {
  it("'##OPEN:' without a space after ## is NOT treated as a decision block", () => {
    const dir = makeTempProject((root) =>
      writeDecisions(root, "# D\n\n##OPEN: glued hashes\n- Context.\n"),
    );
    const result = readDecisions(dir) as DecisionPoint[];
    expect(result.some((d) => d.title.includes("glued hashes"))).toBe(false);
  });

  it("an H3 '### OPEN:' is NOT treated as an H2 decision block", () => {
    // The contract is H2 ("## OPEN:"). A deeper sub-heading must not be a block.
    const dir = makeTempProject((root) =>
      writeDecisions(root, "# D\n\n### OPEN: sub heading\n- Context.\n"),
    );
    const result = readDecisions(dir) as DecisionPoint[];
    expect(result.some((d) => d.title.includes("sub heading"))).toBe(false);
  });

  it("lowercase 'open' / 'closed' are parsed (case-insensitive) with correct resolved flag", () => {
    const dir = makeTempProject((root) =>
      writeDecisions(root, "# D\n\n## open: lower open\n- c\n\n## closed: lower closed\n- c\n"),
    );
    const result = readDecisions(dir) as DecisionPoint[];
    const open = result.find((d) => d.title.includes("lower open"));
    const closed = result.find((d) => d.title.includes("lower closed"));
    expect(open?.resolved).toBe(false);
    expect(closed?.resolved).toBe(true);
  });

  it("'RESOLVED:' is treated as resolved=true", () => {
    const dir = makeTempProject((root) =>
      writeDecisions(root, "# D\n\n## RESOLVED: done thing\n- c\n"),
    );
    const result = readDecisions(dir) as DecisionPoint[];
    const dp = result.find((d) => d.title.includes("done thing"));
    expect(dp?.resolved).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Read-as-is fidelity — Spanish inline markdown must survive verbatim.
// ---------------------------------------------------------------------------

describe("frd-04 [adversarial]: readActivityLog — verbatim fidelity", () => {
  it("preserves inline backticks and Spanish accents in entries", () => {
    const line = "- WO-04-001 completado: `listProjectDocs` con validación de rutas.";
    const dir = makeTempProject((root) => writeProgress(root, `# Log\n${line}\n`));
    const log = readActivityLog(dir) as ActivityLog;
    expect(log.entries).toContain(
      "WO-04-001 completado: `listProjectDocs` con validación de rutas.",
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Read-only / no out-of-tree write via symlinked comms file.
//    These readers join a fixed path; a symlinked progress.md must be read
//    (it is in-tree by name) but never written, and reading must not throw.
// ---------------------------------------------------------------------------

describe("frd-04 [adversarial]: readers are strictly read-only", () => {
  it("reading a symlinked progress.md does not modify the link target", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, ".pandacorp", "comms"), { recursive: true });
      const target = path.join(root, "real-progress.md");
      fs.writeFileSync(target, "# Log\n- linked entry.\n");
      fs.symlinkSync(target, path.join(root, ".pandacorp", "comms", "progress.md"));
    });
    const target = path.join(dir, "real-progress.md");
    const before = fs.statSync(target).mtimeMs;
    const log = readActivityLog(dir) as ActivityLog;
    const after = fs.statSync(target).mtimeMs;
    expect(after).toBe(before);
    // It should still read the content through the symlink.
    expect(log.entries.some((e) => e.includes("linked entry"))).toBe(true);
  });
});
