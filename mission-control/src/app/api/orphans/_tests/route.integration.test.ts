/**
 * FRD-16 review gate — ADVERSARIAL INTEGRATION (reviewer-authored, DR-015/DR-050).
 *
 * Exercises the FRD's work orders TOGETHER against a REAL on-disk fixture tree,
 * with NO mocks: the route handler (WO-16-003) → real getOrphans (WO-16-002) →
 * real bounded scan + classification (WO-16-001) → JSON body.
 *
 * The existing route.test.ts mocks getOrphans, so the end-to-end wiring
 * (route resolves FACTORY_ROOT → scans disk → classifies → serializes) is never
 * exercised. This file closes that gap and adds edge cases the implementers did
 * not anchor at the integration level:
 *   - a real on-disk orphan/unlisted/known mix flows through to JSON intact;
 *   - full-pipeline path normalization: a registered project listed with a
 *     trailing slash must NOT be misreported as an orphan (blueprint §5 risk,
 *     AC-16-002.6 — currently only unit-tested on classifyCandidate);
 *   - the route stays 200 + [] on a degraded (non-existent) factory root.
 *
 * The route reads FACTORY_ROOT from lib/config at import time, so each test sets
 * PANDACORP_FACTORY_ROOT and imports the route module fresh (vi.resetModules).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Candidate } from "@/lib/orphans/orphans";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
  tmpDirs.length = 0;
  vi.unstubAllEnvs();
  vi.resetModules();
});

beforeEach(() => {
  vi.resetModules();
});

/**
 * Build a real factory + projects tree on disk and return the factory root.
 * `registeredRows` are written verbatim into the portfolio Path cell so we can
 * inject non-canonical forms (trailing slash, ./ segments).
 */
function makeRealTree(opts: {
  children: Array<{ name: string; hasGit: boolean; hasMarker: boolean }>;
  /** function(projectsDir) → array of raw Path cells to register in portfolio.md */
  registeredRows?: (projectsDir: string) => Array<{ name: string; rawPath: string }>;
}): { factoryRoot: string; projectsDir: string } {
  const projectsDir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd16-int-proj-"));
  tmpDirs.push(projectsDir);
  const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd16-int-fac-"));
  tmpDirs.push(factoryRoot);

  const factoryDir = path.join(factoryRoot, "factory");
  fs.mkdirSync(factoryDir, { recursive: true });
  fs.writeFileSync(
    path.join(factoryDir, "profile.md"),
    `---\nname: "Test"\nprojects_path: "${projectsDir}"\n---\n`,
    "utf-8",
  );

  for (const child of opts.children) {
    const childPath = path.join(projectsDir, child.name);
    fs.mkdirSync(childPath, { recursive: true });
    if (child.hasGit) fs.mkdirSync(path.join(childPath, ".git"), { recursive: true });
    if (child.hasMarker) {
      fs.mkdirSync(path.join(childPath, ".pandacorp"), { recursive: true });
      fs.writeFileSync(
        path.join(childPath, ".pandacorp", "status.yaml"),
        `project: ${child.name}\nphase: implementation\n`,
      );
    }
  }

  const rows = (opts.registeredRows?.(projectsDir) ?? [])
    .map((r) => `| ${r.name} | ${r.rawPath} | — | — | — | — | — | — | — |`)
    .join("\n");
  fs.writeFileSync(
    path.join(factoryDir, "portfolio.md"),
    `# Portfolio\n\n| Name | Path | Repo | Origin idea | Phase | Users | Return metric | Verdict | Last sync |\n|---|---|---|---|---|---|---|---|---|\n${rows}\n`,
    "utf-8",
  );

  return { factoryRoot, projectsDir };
}

/** Import the route handler fresh, bound to the given factory root. */
async function getHandlerFor(factoryRoot: string) {
  vi.stubEnv("PANDACORP_FACTORY_ROOT", factoryRoot);
  vi.resetModules();
  const mod = await import("../route");
  return mod.GET;
}

describe("FRD-16 review gate — route → getOrphans → scan, real disk, no mocks", () => {
  it("a real on-disk orphan/unlisted/known mix serializes to the correct JSON through GET", async () => {
    const { factoryRoot, projectsDir } = makeRealTree({
      children: [
        { name: "stray", hasGit: true, hasMarker: false }, // → orphan
        { name: "marked-unlisted", hasGit: true, hasMarker: true }, // → unlisted
        { name: "known", hasGit: true, hasMarker: true }, // → null (registered)
        { name: "plain", hasGit: false, hasMarker: false }, // → skipped (no .git)
      ],
      registeredRows: (dir) => [{ name: "known", rawPath: path.join(dir, "known") }],
    });

    const GET = await getHandlerFor(factoryRoot);
    const res = GET(new Request("http://localhost/api/orphans"));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Candidate[];

    const byName = Object.fromEntries(body.map((c) => [c.name, c]));
    expect(Object.keys(byName).sort()).toEqual(["marked-unlisted", "stray"]);
    expect(byName.stray?.kind).toBe("orphan");
    expect(byName.stray?.path).toBe(path.join(projectsDir, "stray"));
    expect(byName["marked-unlisted"]?.kind).toBe("unlisted");
    expect(byName["marked-unlisted"]?.hasMarker).toBe(true);
    // The registered + the no-.git folder must be absent from the response.
    expect(byName.known).toBeUndefined();
    expect(byName.plain).toBeUndefined();
  });

  it("REGRESSION GUARD (AC-16-002.6 integration): a project registered with a TRAILING SLASH is not a false orphan", async () => {
    // The portfolio reader returns the path verbatim; only classifyCandidate
    // normalizes. This proves the normalization survives the full pipeline,
    // which the unit tests register in already-canonical form and never check.
    const { factoryRoot } = makeRealTree({
      children: [{ name: "trailing", hasGit: true, hasMarker: false }],
      registeredRows: (dir) => [
        // raw cell intentionally has a trailing separator
        { name: "trailing", rawPath: `${path.join(dir, "trailing")}${path.sep}` },
      ],
    });

    const GET = await getHandlerFor(factoryRoot);
    const res = GET(new Request("http://localhost/api/orphans"));
    const body = (await res.json()) as Candidate[];

    expect(res.status).toBe(200);
    // Registered (modulo trailing slash) → must NOT appear as an orphan.
    expect(body.find((c) => c.name === "trailing")).toBeUndefined();
  });

  it("REGRESSION GUARD (AC-16-002.6 integration): a project registered with ./ redundant segments is not a false orphan", async () => {
    const { factoryRoot } = makeRealTree({
      children: [{ name: "dotseg", hasGit: true, hasMarker: false }],
      registeredRows: (dir) => [
        // /<dir>/./dotseg — same target, non-canonical form
        { name: "dotseg", rawPath: path.join(dir, ".", "dotseg") },
      ],
    });

    const GET = await getHandlerFor(factoryRoot);
    const res = GET(new Request("http://localhost/api/orphans"));
    const body = (await res.json()) as Candidate[];

    expect(body.find((c) => c.name === "dotseg")).toBeUndefined();
  });

  it("a degraded scan (factory root that does not exist) returns 200 with [] — never 500", async () => {
    const ghostParent = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd16-ghost-"));
    tmpDirs.push(ghostParent);
    const ghost = path.join(ghostParent, "does-not-exist");

    const GET = await getHandlerFor(ghost);
    const res = GET(new Request("http://localhost/api/orphans"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual([]);
  });

  it("read-only invariant survives the round trip: the fixture tree is byte-identical after a GET", async () => {
    const { factoryRoot, projectsDir } = makeRealTree({
      children: [{ name: "stray", hasGit: true, hasMarker: false }],
    });

    const snapshot = (dir: string): string[] =>
      fs
        .readdirSync(dir, { recursive: true })
        .map((e) => String(e))
        .sort();
    const before = snapshot(projectsDir);

    const GET = await getHandlerFor(factoryRoot);
    GET(new Request("http://localhost/api/orphans"));

    // No probe artifact (e.g. a created .git) and no portfolio write.
    expect(snapshot(projectsDir)).toEqual(before);
  });
});
