/**
 * WO-24-001 — `parseDecisionBlocks` extraction + `decision-id-cli.mjs` — RED phase
 *
 * FRD-24, REQ-24-001. `parseDecisionBlocks` does not yet exist as an export of
 * `../activity`; the CLI `scripts/decisions/decision-id-cli.mjs` does not yet exist.
 * Every test here fails (RED) until the GREEN phase.
 *
 * Traceability:
 *   AC-24-001.1 — the extracted pure function, run over the exact content
 *                 `readDecisions()` already parses, returns the identical ordered
 *                 `DecisionPoint[]` (ids included) `readDecisions()` returns today.
 *   AC-24-001.2 — the derivation is reachable from a plain Node script outside the
 *                 Next.js runtime: `pnpm decisions:ids <path>` / the raw `node --loader`
 *                 invocation prints the same ordered id list, one per line.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type DecisionPoint, parseDecisionBlocks, readDecisions } from "../activity";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const CLI_PATH = path.join(REPO_ROOT, "scripts", "decisions", "decision-id-cli.mjs");
const LOADER_PATH = path.join(REPO_ROOT, "scripts", "read-model", "ts-loader.mjs");

const tmpDirs: string[] = [];

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-docs-wo24001-"));
  tmpDirs.push(dir);
  return dir;
}

function writeDecisions(root: string, content: string): string {
  const inboxDir = path.join(root, ".pandacorp", "inbox");
  fs.mkdirSync(inboxDir, { recursive: true });
  const filePath = path.join(inboxDir, "decisions.md");
  fs.writeFileSync(filePath, content);
  return filePath;
}

afterEach(() => {
  while (tmpDirs.length) {
    const dir = tmpDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

const FIXTURE_CONTENT = `# Decisions

## 2026-09-01 (NECESITA DECISIÓN DEL OWNER) — First pending block
- **Recommendation:** ship it

## 2026-09-01 — Second block, same date
- **Estado:** RESUELTO: done already

## OPEN: Legacy open block
Body text here.

## CLOSED: Legacy closed block
- **Recomendación:** archive it

## 2026-09-02 (SUPERSEDIDO) — An obsolete dated block
`;

// -----------------------------------------------------------------------------
// AC-24-001.1 — parseDecisionBlocks is the SAME derivation readDecisions() runs.
// -----------------------------------------------------------------------------

describe("frd-24: parseDecisionBlocks — AC-24-001.1 identical to readDecisions()", () => {
  it("frd-24: AC-24-001.1 — parseDecisionBlocks is exported from ../activity", () => {
    expect(typeof parseDecisionBlocks).toBe("function");
  });

  it("frd-24: AC-24-001.1 — parseDecisionBlocks(content) equals readDecisions(projectPath) for the same content", () => {
    const dir = makeTempProject();
    writeDecisions(dir, FIXTURE_CONTENT);

    const viaProjectPath = readDecisions(dir);
    const viaContent = parseDecisionBlocks(FIXTURE_CONTENT);

    expect(viaContent).toEqual(viaProjectPath);
  });

  it("frd-24: AC-24-001.1 — parseDecisionBlocks returns the ordered ids readDecisions() derives, unchanged", () => {
    const dir = makeTempProject();
    writeDecisions(dir, FIXTURE_CONTENT);

    const ids = readDecisions(dir).map((d: DecisionPoint) => d.id);
    expect(ids).toEqual(parseDecisionBlocks(FIXTURE_CONTENT).map((d) => d.id));
    // Sanity: the fixture actually exercises the dated-counter + legacy-counter rules.
    expect(ids).toEqual(["2026-09-01-1", "2026-09-01-2", "legacy-1", "legacy-2", "2026-09-02-1"]);
  });

  it("frd-24: AC-24-001.1 — parseDecisionBlocks on an empty string returns []", () => {
    expect(parseDecisionBlocks("")).toEqual([]);
  });

  it("frd-24: AC-24-001.1 — parseDecisionBlocks is a genuine JS Array (Array.isArray)", () => {
    expect(Array.isArray(parseDecisionBlocks(FIXTURE_CONTENT))).toBe(true);
  });

  it("frd-24: AC-24-001.1 — readDecisions() still guards a missing project path (returns [], never throws)", () => {
    expect(() => readDecisions("/nonexistent/project/path/wo24001-probe")).not.toThrow();
    expect(readDecisions("/nonexistent/project/path/wo24001-probe")).toEqual([]);
  });

  it("frd-24: AC-24-001.1 — readDecisions() still guards an empty project path (returns [])", () => {
    expect(readDecisions("")).toEqual([]);
  });

  it("frd-24: AC-24-001.1 — readDecisions() still guards a project with no decisions.md (returns [])", () => {
    const dir = makeTempProject();
    expect(readDecisions(dir)).toEqual([]);
  });
});

// -----------------------------------------------------------------------------
// AC-24-001.2 — the CLI is reachable from a plain Node script outside Next.js.
// -----------------------------------------------------------------------------

describe("frd-24: decision-id-cli.mjs — AC-24-001.2 plain-Node CLI over the same derivation", () => {
  it("frd-24: AC-24-001.2 — the CLI file exists on disk", () => {
    expect(fs.existsSync(CLI_PATH)).toBe(true);
  });

  it("frd-24: AC-24-001.2 — running the CLI against a fixture prints the same ordered ids parseDecisionBlocks returns, one per line", () => {
    const dir = makeTempProject();
    const filePath = writeDecisions(dir, FIXTURE_CONTENT);

    const stdout = execFileSync(process.execPath, ["--loader", LOADER_PATH, CLI_PATH, filePath], {
      cwd: REPO_ROOT,
      encoding: "utf8",
    });

    const printedIds = stdout.split("\n").filter((line) => line.length > 0);
    const expectedIds = parseDecisionBlocks(FIXTURE_CONTENT).map((d) => d.id);
    expect(printedIds).toEqual(expectedIds);
  });

  it("frd-24: AC-24-001.2 — the CLI's module source imports no Next.js/React framework module", () => {
    const source = fs.readFileSync(CLI_PATH, "utf8");
    expect(source).not.toMatch(/from\s+["']next/);
    expect(source).not.toMatch(/from\s+["']react/);
  });

  it("frd-24: AC-24-001.2 — a missing decisions.md path exits non-zero with a stderr message", () => {
    const missingPath = path.join(os.tmpdir(), "mc-docs-wo24001-does-not-exist", "decisions.md");
    expect(() =>
      execFileSync(process.execPath, ["--loader", LOADER_PATH, CLI_PATH, missingPath], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    ).toThrow();

    try {
      execFileSync(process.execPath, ["--loader", LOADER_PATH, CLI_PATH, missingPath], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      const err = error as { status: number | null; stderr: string };
      expect(err.status).not.toBe(0);
      expect(err.stderr.trim().length).toBeGreaterThan(0);
    }
  });
});
