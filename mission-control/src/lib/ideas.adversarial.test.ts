/**
 * WO-01-003 — `readIdeas` ADVERSARIAL tests (reviewer, DR-015).
 *
 * Written by the reviewer (Opus 4.8) — a DIFFERENT model from the implementer —
 * to probe edge cases, malformed inputs and validation branches the implementer's
 * own suite (`lib/ideas.test.ts`) did NOT cover. Every assertion below was first
 * confirmed against gray-matter's real behavior (no guessing).
 *
 * Each test isolates one validation branch in `readIdeas`, so mutation testing
 * (DR-016) on that branch breaks at least one of these. These build their own
 * temp fixture trees and pass an explicit `ideasDir` (contract: readIdeas(dir?)).
 *
 * Traceability: AC-01-003.1 + blueprint §3 tolerance rules.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readIdeas } from "./ideas";

let tmpDir: string;

/** Write a single card file into the temp ideas dir. */
function writeCard(name: string, content: string): void {
  fs.writeFileSync(path.join(tmpDir, name), content, "utf-8");
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ideas-adv-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("frd-01 adversarial: status validation", () => {
  it("frd-01 adv: a card with an UNKNOWN status (not in the union) is skipped, not returned with a bogus status", () => {
    writeCard("idea-bad-status.md", "---\ntitle: Bad\nstatus: archived\n---\nbody\n");
    writeCard("idea-good.md", "---\ntitle: Good\nstatus: discovered\n---\nbody\n");
    const ideas = readIdeas(tmpDir);
    expect(ideas.map((c) => c.slug)).toEqual(["idea-good"]);
  });

  it("frd-01 adv: a card with status MISSING entirely is skipped", () => {
    writeCard("idea-no-status.md", "---\ntitle: NoStatus\n---\nbody\n");
    expect(readIdeas(tmpDir)).toHaveLength(0);
  });

  it("frd-01 adv: a card whose status is the WRONG type (number) is skipped", () => {
    writeCard("idea-num-status.md", "---\ntitle: T\nstatus: 1\n---\nbody\n");
    expect(readIdeas(tmpDir)).toHaveLength(0);
  });
});

describe("frd-01 adversarial: title validation", () => {
  it("frd-01 adv: a card with a NON-STRING title (number) is skipped (title must be a string)", () => {
    writeCard("idea-num-title.md", "---\ntitle: 123\nstatus: discovered\n---\nbody\n");
    expect(readIdeas(tmpDir)).toHaveLength(0);
  });

  it("frd-01 adv: a card with title MISSING is skipped", () => {
    writeCard("idea-no-title.md", "---\nstatus: discovered\n---\nbody\n");
    expect(readIdeas(tmpDir)).toHaveLength(0);
  });
});

describe("frd-01 adversarial: score coercion guards", () => {
  it("frd-01 adv: a QUOTED string score ('72') is NOT coerced to a number → score undefined", () => {
    writeCard("idea-str-score.md", '---\ntitle: T\nstatus: discovered\nscore: "72"\n---\nbody\n');
    const card = readIdeas(tmpDir)[0];
    expect(card).toBeDefined();
    expect(card?.score).toBeUndefined();
  });

  it("frd-01 adv: score 0 is PRESERVED as 0, never dropped by a truthiness check", () => {
    // Guards against a mutation `if (fm.score)` instead of `typeof === number`.
    writeCard("idea-zero-score.md", "---\ntitle: T\nstatus: discovered\nscore: 0\n---\nbody\n");
    const card = readIdeas(tmpDir)[0];
    expect(card?.score).toBe(0);
  });
});

describe("frd-01 adversarial: returnType validation (invalid value tolerated, card kept)", () => {
  it("frd-01 adv: an INVALID return_type leaves returnType undefined but the card is STILL returned", () => {
    writeCard(
      "idea-bad-return.md",
      "---\ntitle: T\nstatus: discovered\nreturn_type: galaxy-brained\n---\nbody\n",
    );
    const ideas = readIdeas(tmpDir);
    expect(ideas).toHaveLength(1);
    expect(ideas[0]?.returnType).toBeUndefined();
  });

  it("frd-01 adv: each of the four valid return_type values round-trips", () => {
    for (const rt of ["monetary", "opportunity", "personal", "mixed"]) {
      writeCard(`idea-${rt}.md`, `---\ntitle: T\nstatus: discovered\nreturn_type: ${rt}\n---\nb\n`);
    }
    const byReturn = new Set(readIdeas(tmpDir).map((c) => c.returnType));
    expect(byReturn).toEqual(new Set(["monetary", "opportunity", "personal", "mixed"]));
  });
});

describe("frd-01 adversarial: degenerate files", () => {
  it("frd-01 adv: a 0-byte file (no frontmatter, no body) is skipped without throwing", () => {
    writeCard("idea-empty.md", "");
    expect(() => readIdeas(tmpDir)).not.toThrow();
    expect(readIdeas(tmpDir)).toHaveLength(0);
  });

  it("frd-01 adv: a file with body text but NO frontmatter block is skipped (no title/status)", () => {
    writeCard("idea-bodyonly.md", "Just prose, no YAML at all.\n");
    expect(readIdeas(tmpDir)).toHaveLength(0);
  });

  it("frd-01 adv: a non-.md file in the ideas dir is ignored entirely", () => {
    writeCard("notes.txt", "---\ntitle: T\nstatus: discovered\n---\nbody\n");
    writeCard("idea-real.md", "---\ntitle: Real\nstatus: discovered\n---\nbody\n");
    expect(readIdeas(tmpDir).map((c) => c.slug)).toEqual(["idea-real"]);
  });

  it("frd-01 adv: a card with valid frontmatter but EMPTY body yields body === '' (string, not undefined)", () => {
    writeCard("idea-nobody.md", "---\ntitle: T\nstatus: discovered\n---\n");
    const card = readIdeas(tmpDir)[0];
    expect(card?.body).toBe("");
  });
});

describe("frd-01 adversarial: projectType mapping is string-typed", () => {
  it("frd-01 adv: a NON-STRING project_type (list) leaves projectType undefined, card kept", () => {
    writeCard(
      "idea-list-pt.md",
      "---\ntitle: T\nstatus: discovered\nproject_type:\n  - a\n  - b\n---\nbody\n",
    );
    const ideas = readIdeas(tmpDir);
    expect(ideas).toHaveLength(1);
    expect(ideas[0]?.projectType).toBeUndefined();
  });
});
