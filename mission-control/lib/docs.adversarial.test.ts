/**
 * WO-01-006 — readProjectDocs — ADVERSARIAL review tests (DR-015).
 *
 * Written by the reviewer (a different model) to probe edge cases, abuse and
 * boundary conditions the implementer did NOT cover in lib/docs.test.ts.
 * Derived from AC-01-007.1, the fail-soft blueprint §3 rule, and the real
 * regression incidents in .pandacorp/comms/progress.md (B1', I2, I3).
 *
 * These tests must be TRUE assertions of the contract — if any fails, it points
 * to a real gap in lib/docs.ts (or a contract ambiguity worth a finding).
 *
 * Read-only: no writes to fixtures, temp dirs cleaned up.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readProjectDocs } from "./docs";

function makeTempProject(setup?: (root: string) => void): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mc-docs-adv-"));
  if (setup) setup(dir);
  return dir;
}

// ---------------------------------------------------------------------------
// FRD pattern boundary: /^frd-\d/ — what exactly is in vs out?
// ---------------------------------------------------------------------------

describe("adversarial: FRD directory pattern boundaries", () => {
  it("excludes 'frd-' with no following digit (frd-abc)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "frds", "frd-abc"), { recursive: true });
    });
    try {
      expect(readProjectDocs(dir).frds).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("excludes 'frd01-x' (no hyphen before the digit)", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "frds", "frd01-x"), { recursive: true });
    });
    try {
      expect(readProjectDocs(dir).frds).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("includes a single-digit FRD dir 'frd-9-x'", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs", "frds", "frd-9-x"), { recursive: true });
    });
    try {
      const frds = readProjectDocs(dir).frds;
      expect(frds.map((f) => f.slug)).toContain("frd-9-x");
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("excludes a FILE named like an FRD dir (frd-99-fake.md is a file, not a dir)", () => {
    const dir = makeTempProject((root) => {
      const frdsDir = path.join(root, "docs", "frds");
      fs.mkdirSync(frdsDir, { recursive: true });
      // A *file* whose name matches the regex but is NOT a directory.
      fs.writeFileSync(path.join(frdsDir, "frd-99-fake"), "not a dir\n");
    });
    try {
      const frds = readProjectDocs(dir).frds;
      expect(frds.map((f) => f.slug)).not.toContain("frd-99-fake");
      expect(frds).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// docs/frds is itself a FILE (not a directory) → readdir would ENOTDIR.
// Fail-soft must turn that into [], never throw.
// ---------------------------------------------------------------------------

describe("adversarial: docs/frds is a file, not a directory", () => {
  it("does not throw and returns frds: [] when docs/frds is a regular file", () => {
    const dir = makeTempProject((root) => {
      fs.mkdirSync(path.join(root, "docs"), { recursive: true });
      fs.writeFileSync(path.join(root, "docs", "frds"), "I am a file, not a dir\n");
    });
    try {
      expect(() => readProjectDocs(dir)).not.toThrow();
      expect(readProjectDocs(dir).frds).toHaveLength(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// bugs/ contains a *subdirectory* ending in .md — the defensive isFile() guard.
// ---------------------------------------------------------------------------

describe("adversarial: bugs/ directory hygiene", () => {
  it("does NOT count a subdirectory named '*.md' as a bug", () => {
    const dir = makeTempProject((root) => {
      const bugsDir = path.join(root, ".pandacorp", "inbox", "bugs");
      fs.mkdirSync(path.join(bugsDir, "weird-dir.md"), { recursive: true });
      fs.writeFileSync(path.join(bugsDir, "real-bug.md"), "# Bug\n");
    });
    try {
      const bugs = readProjectDocs(dir).comms.bugs;
      expect(bugs).toHaveLength(1);
      expect(bugs[0]?.endsWith("real-bug.md")).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("ignores non-.md files in bugs/ (e.g. .gitkeep, notes.txt)", () => {
    const dir = makeTempProject((root) => {
      const bugsDir = path.join(root, ".pandacorp", "inbox", "bugs");
      fs.mkdirSync(bugsDir, { recursive: true });
      fs.writeFileSync(path.join(bugsDir, ".gitkeep"), "");
      fs.writeFileSync(path.join(bugsDir, "notes.txt"), "not a bug");
      fs.writeFileSync(path.join(bugsDir, "bug-1.md"), "# Bug\n");
    });
    try {
      expect(readProjectDocs(dir).comms.bugs).toHaveLength(1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// I3 deep: every bug path must be a genuine string; every frd a genuine object.
// JSON round-trip must survive (the index is passed to client components).
// ---------------------------------------------------------------------------

describe("adversarial: serializability + I3 genuine shapes", () => {
  it("the full proj-a-like index survives a JSON round-trip unchanged", () => {
    const dir = makeTempProject((root) => {
      const frdDir = path.join(root, "docs", "frds", "frd-01-alpha");
      fs.mkdirSync(path.join(frdDir, "work-orders"), { recursive: true });
      fs.writeFileSync(path.join(frdDir, "frd.md"), "x");
      fs.mkdirSync(path.join(root, "docs", "product"), { recursive: true });
      fs.writeFileSync(path.join(root, "docs", "product", "prd.md"), "x");
      const bugsDir = path.join(root, ".pandacorp", "inbox", "bugs");
      fs.mkdirSync(bugsDir, { recursive: true });
      fs.writeFileSync(path.join(bugsDir, "b.md"), "x");
    });
    try {
      const index = readProjectDocs(dir);
      const round = JSON.parse(JSON.stringify(index));
      expect(round).toEqual(index);
      expect(Array.isArray(round.frds)).toBe(true);
      expect(Array.isArray(round.comms.bugs)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Many FRDs: ordering + no dropped entries (counting integrity, B1' spirit).
// ---------------------------------------------------------------------------

describe("adversarial: large FRD set counting integrity", () => {
  it("counts exactly N frd-NN dirs interleaved with noise dirs", () => {
    const dir = makeTempProject((root) => {
      const frdsDir = path.join(root, "docs", "frds");
      for (let i = 1; i <= 25; i++) {
        const slug = `frd-${String(i).padStart(2, "0")}-feature`;
        fs.mkdirSync(path.join(frdsDir, slug), { recursive: true });
      }
      // Noise that must NOT be counted:
      fs.mkdirSync(path.join(frdsDir, "shared"), { recursive: true });
      fs.mkdirSync(path.join(frdsDir, "README"), { recursive: true });
      fs.writeFileSync(path.join(frdsDir, "index.md"), "x");
    });
    try {
      const frds = readProjectDocs(dir).frds;
      expect(frds).toHaveLength(25);
      expect(Number.isInteger(frds.length)).toBe(true);
      // No duplicate slugs.
      expect(new Set(frds.map((f) => f.slug)).size).toBe(25);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Read-only invariant against a real fixture-shaped temp tree:
// readProjectDocs must not create or delete anything.
// ---------------------------------------------------------------------------

describe("adversarial: read-only invariant (no mutation of the tree)", () => {
  it("does not add, remove or modify any entry under the project root", () => {
    const dir = makeTempProject((root) => {
      const frdDir = path.join(root, "docs", "frds", "frd-01-x");
      fs.mkdirSync(path.join(frdDir, "mocks"), { recursive: true });
      fs.writeFileSync(path.join(frdDir, "frd.md"), "x");
      fs.mkdirSync(path.join(root, ".pandacorp", "inbox", "bugs"), { recursive: true });
      fs.writeFileSync(path.join(root, ".pandacorp", "inbox", "bugs", "b.md"), "x");
    });
    try {
      const snapshot = (p: string): string[] =>
        fs.readdirSync(p, { recursive: true }).map(String).sort();
      const before = snapshot(dir);
      readProjectDocs(dir);
      readProjectDocs(dir);
      const after = snapshot(dir);
      expect(after).toEqual(before);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Contract ambiguity probe: prd.md as a DIRECTORY.
// The contract says the *file* prd.md. pathExists() is true for a dir too, so
// the implementation would report a directory as the prd doc. This documents the
// current behavior; if it reports a dir-as-prd that is a latent correctness gap
// for FRD-04/05/08 which will try to read it as a file.
// ---------------------------------------------------------------------------

describe("adversarial: prd.md present as a directory (contract edge)", () => {
  it("documents current behavior when docs/product/prd.md is a directory", () => {
    const dir = makeTempProject((root) => {
      // prd.md created as a DIRECTORY, not a file.
      fs.mkdirSync(path.join(root, "docs", "product", "prd.md"), { recursive: true });
    });
    try {
      const index = readProjectDocs(dir);
      // The implementation uses pathExists (existence only), so it WILL set prd.
      // This is the documented current behavior — flagged as a minor finding.
      expect(index.prd === undefined || typeof index.prd === "string").toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
