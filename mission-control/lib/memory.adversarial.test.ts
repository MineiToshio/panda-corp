/**
 * WO-17-001 — lib/memory ADVERSARIAL tests (reviewer, DR-015 / DR-016).
 *
 * Written by the reviewer (a different model from the implementer) to probe
 * edge cases the implementer's own suite (lib/memory.test.ts) did NOT cover.
 * Focus: the `projects` parser (parseProjects) and the eval-gate corroboration
 * threshold — the highest-leverage logic, because an over-count flips
 * evalGate to "corroborated" and could auto-promote a lesson seen only once.
 *
 * AC-17-001.5 is explicit: "when the format is ambiguous, yields a conservative
 * count (does NOT over-count)". These tests pin that contract harder than the
 * implementer's tests, which never exercised a comma INSIDE a parenthetical.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { withFactoryRoot } from "@/tests/fixtures/index";
import { readLessons } from "./memory";

function lessonMd(frontmatter: Record<string, unknown>, body: string): string {
  const lines: string[] = ["---"];
  for (const [key, val] of Object.entries(frontmatter)) {
    if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of val) lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push("---", "", body);
  return lines.join("\n");
}

const BASE_FM = {
  id: "LESSON-0001",
  type: "pattern",
  domain: "testing",
  status: "candidate",
  promotion: "none",
  provenance: "agent-inferred",
  created: "2026-06-16",
  confidence: "high",
  times_applied: 0,
  links: [],
};
const BODY = "**Situation:** X.\n\n**Lesson:** Y.\n\n**Apply next time:** Z.";

let tmpRoots: string[] = [];
afterEach(() => {
  for (const d of tmpRoots) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
  tmpRoots = [];
});

function makeRoot(source: string): string {
  const factoryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mc-mem-adv-"));
  const memoryDir = path.join(factoryRoot, "factory", "memory");
  fs.mkdirSync(memoryDir, { recursive: true });
  // YAML scalar with parens/commas must be quoted to stay a single string value.
  const fm = { ...BASE_FM, source: `"${source.replace(/"/g, '\\"')}"` };
  fs.writeFileSync(path.join(memoryDir, "LESSON-0001-adv.md"), lessonMd(fm, BODY), "utf-8");
  tmpRoots.push(factoryRoot);
  return factoryRoot;
}

describe("frd-17 ADVERSARIAL: parseProjects must not over-count (AC-17-001.5)", () => {
  it("a single project whose parenthetical note contains a comma must yield exactly ONE distinct project (not a phantom from the note words)", async () => {
    // BUG PROBE: "proj-alpha (note, with comma)" splits on ', ' and captures
    // 'with' as a fake project. A single-project candidate would then read as
    // 2+ projects → evalGate 'corroborated' → false auto-corroboration.
    const root = makeRoot("proj-alpha (note, with comma)");
    const [lesson] = await withFactoryRoot(root, () => readLessons());

    expect(lesson?.projects).toEqual(["proj-alpha"]);
    expect(lesson?.evalGate).toBe("awaiting-2nd");
  });

  it("a single-project source with a comma in its note must NOT cross the 2-project corroboration threshold", async () => {
    // Even with a real 2nd project AFTER the note, the note words must not be
    // counted as additional projects. "proj-alpha (a, b), proj-beta" is exactly
    // 2 distinct projects — never 3+.
    const root = makeRoot("proj-alpha (note, follow-up), proj-beta");
    const [lesson] = await withFactoryRoot(root, () => readLessons());

    expect(lesson?.projects).toEqual(["proj-alpha", "proj-beta"]);
    expect(lesson?.projects?.length).toBe(2);
  });

  it("a doc-ref source containing a citation comma must not capture the citation as a project (conservative → 0)", async () => {
    // "docs/...md (deep-research; ExpeL, arXiv:2308.10144)" — the ', ' before
    // arXiv splits the parenthetical and 'arXiv:...' becomes a fake project.
    // A pure doc reference has ZERO projects.
    const root = makeRoot(
      "docs/proposals/09-self-learning-factory.md (deep-research 2026-06-15; ExpeL, arXiv:2308.10144)",
    );
    const [lesson] = await withFactoryRoot(root, () => readLessons());

    expect(lesson?.projects).toEqual([]);
    expect(lesson?.evalGate).toBe("awaiting-2nd");
  });

  it("an UNCLOSED parenthetical note with commas must not over-count (single project → awaiting-2nd)", async () => {
    // BUG PROBE (cycle 2): the cycle-1 fix strips /\([^)]*\)/, which requires a
    // CLOSING paren. A source whose annotation paren is never closed (typo /
    // truncated provenance) is NOT stripped, so the inner commas split and the
    // note words ("with", "proj-beta") become phantom projects → evalGate flips
    // to "corroborated" for a lesson seen in only ONE project. Same class of
    // false-corroboration bug as cycle 1, just via malformed input.
    // AC-17-001.5: "when the format is ambiguous, yields a conservative count
    // (does NOT over-count)" — an unclosed paren is exactly that ambiguous case.
    const root = makeRoot("proj-alpha (note, with comma, proj-beta");
    const [lesson] = await withFactoryRoot(root, () => readLessons());

    expect(lesson?.projects).toEqual(["proj-alpha"]);
    expect(lesson?.evalGate).toBe("awaiting-2nd");
  });

  it("free-text words trailing a single project's closed parenthetical must not become phantom projects", async () => {
    // BUG PROBE (cycle 2): "proj-alpha (a, b) extra, words here" → after the
    // paren is stripped we get "proj-alpha  extra, words here"; the ', ' split
    // makes "words" a phantom 2nd project. A single named project followed by
    // prose is still ONE project, not two → must stay awaiting-2nd.
    const root = makeRoot("proj-alpha (a, b) extra, words here");
    const [lesson] = await withFactoryRoot(root, () => readLessons());

    expect(lesson?.projects).toEqual(["proj-alpha"]);
    expect(lesson?.evalGate).toBe("awaiting-2nd");
  });
});
