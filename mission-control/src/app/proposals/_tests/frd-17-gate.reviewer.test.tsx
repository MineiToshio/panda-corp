/**
 * FRD-17 — REVIEWER FRD-GATE adversarial integration tests (DR-015 / DR-050).
 *
 * Written at the FRD gate by a model distinct from the implementers. The prior
 * reviewer runs already cover the corroboration gate, stream membership and the
 * read-only invariant of the memory readers (proposals-integration.reviewer),
 * plus dismiss-affordance presence and the no-empty-inputs wiring contract
 * (proposals-wiring.reviewer). These add the integration edges those did NOT
 * cover, exercising the work orders TOGETHER through the REAL pipeline:
 *
 *   gatherSuggestionsInput()  (WO-17-004 wiring, real fs readers)
 *         →  computeSuggestions()                 (WO-17-003)
 *         →  ProposalStream (WO-17-008)
 *
 * Focus (gaps in the existing suites):
 *   1. The whole gather→compute wiring is fail-soft AND read-only against a REAL
 *      temp factory (the existing wiring test mocks computeSuggestions away, so
 *      gather.ts itself was never exercised end-to-end at the gate).
 *   2. A genuine bottleneck assembled from real board cards surfaces a real
 *      self-suggestion through the live readers — proving the 5 wired derivations
 *      are not dead in production (REQ-17-004), not just "inputs non-empty".
 *   3. Per-card dismissal is out of v2 (owner decision 2026-10-21), so the rendered
 *      streams must expose none and remember none.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import { gatherSuggestionsInput } from "@/lib/self-suggest/gather";
import { computeSuggestions } from "@/lib/self-suggest/self-suggest";
import { withFactoryRoot } from "@/tests/fixtures";
import { ProposalStream } from "../_components/ProposalStream/ProposalStream";

// ---------------------------------------------------------------------------
// Temp factory builder (board cards + memory + portfolio)
// ---------------------------------------------------------------------------

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
  try {
    localStorage.clear();
  } catch {
    /* jsdom may not expose it */
  }
});

function makeFactoryRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd17-gate-"));
  tmpRoots.push(root);
  return root;
}

/** Write a discovered idea card (no project) into factory/ideas/. */
function writeIdeaCard(root: string, slug: string, status: string): void {
  const ideasDir = path.join(root, "factory", "ideas");
  fs.mkdirSync(ideasDir, { recursive: true });
  const fm = ["---", `title: ${slug}`, `status: ${status}`, "---", "", `# ${slug}`, ""].join("\n");
  fs.writeFileSync(path.join(ideasDir, `${slug}.md`), fm, "utf-8");
}

// ---------------------------------------------------------------------------
// 1. The gather→compute wiring is fail-soft AND read-only against a real factory
// ---------------------------------------------------------------------------

describe("FRD-17 GATE: gatherSuggestionsInput + computeSuggestions are fail-soft and read-only end-to-end", () => {
  it("a nearly-empty factory (no ideas, no portfolio, no events) never throws and writes nothing", async () => {
    const root = makeFactoryRoot();
    // factory/ exists but is essentially empty — the fresh-factory edge.
    fs.mkdirSync(path.join(root, "factory"), { recursive: true });

    const snapshotBefore = snapshotTree(root);

    const result = await withFactoryRoot(root, () => {
      const input = gatherSuggestionsInput();
      // The wiring layer must always return a valid bag (AC-17-003.7).
      return computeSuggestions(input);
    });

    expect(Array.isArray(result)).toBe(true);
    // Nothing the readers touched may have mutated the factory tree.
    expect(snapshotTree(root)).toEqual(snapshotBefore);
  });

  it("gatherSuggestionsInput always returns the full input shape (every field present) even on a bare factory", async () => {
    const root = makeFactoryRoot();
    fs.mkdirSync(path.join(root, "factory"), { recursive: true });

    const input = await withFactoryRoot(root, () => gatherSuggestionsInput());

    // Every field the pure derivation reads must exist (no undefined → no
    // "cannot read property of undefined" inside computeSuggestions).
    expect(input).toHaveProperty("boardColumnCounts");
    expect(input).toHaveProperty("portfolioItems");
    expect(input).toHaveProperty("events");
    expect(input).toHaveProperty("capabilities");
    expect(input).toHaveProperty("decisionRules");
    expect(input).toHaveProperty("inboxDecisionLines");
    expect(input).toHaveProperty("lessons");
    expect(Array.isArray(input.portfolioItems)).toBe(true);
    expect(Array.isArray(input.events)).toBe(true);
    expect(Array.isArray(input.lessons)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. A real bottleneck of board cards surfaces a real self-suggestion
//    (the 5 wired derivations are NOT dead in production — REQ-17-004)
// ---------------------------------------------------------------------------

describe("FRD-17 GATE: a real board bottleneck surfaces a live self-suggestion through the wiring (REQ-17-004)", () => {
  it("≥ BOTTLENECK_THRESHOLD discovered ideas produce a real bottleneck suggestion end-to-end (not hardcoded-empty)", async () => {
    const root = makeFactoryRoot();
    // Pile up 6 discovered ideas — over BOTTLENECK_THRESHOLD (5).
    for (let i = 0; i < 6; i++) {
      writeIdeaCard(root, `idea-${i}`, "discovered");
    }

    const suggestions = await withFactoryRoot(root, () =>
      computeSuggestions(gatherSuggestionsInput()),
    );

    const bottlenecks = suggestions.filter((s) => s.kind === "bottleneck");
    // This is the proof the implementers' wiring fix is real: with empty literals
    // (the pre-repair page) this would be []. Through the live readers it fires.
    expect(bottlenecks.length).toBeGreaterThan(0);
    // The command must be the exact FRD-mandated /pandacorp:* (AC-17-003.2).
    expect(bottlenecks[0]?.command).toBe("/pandacorp:recommend");
    // Honest evidence: it names the column + the count (not a vague nag).
    expect(bottlenecks[0]?.evidence).toMatch(/\d+/);
  });
});

// ---------------------------------------------------------------------------
// 3. Per-card dismissal is out of v2: no stream may expose or remember one
// ---------------------------------------------------------------------------

const CANDIDATE: Lesson = {
  id: "LESSON-0099",
  type: "gotcha",
  domain: "testing",
  context: "resumen de una línea de la lección",
  status: "candidate",
  promotion: "none",
  source: "proj-alpha (WO-01-001)",
  links: [],
  projects: ["proj-alpha"],
  body: "**Situation:** S.\n\n**Lesson:** L.\n\n**Apply next time:** A.",
  trigger: "",
  appliedIn: [],
  evalGate: "awaiting-2nd",
};

describe("FRD-17 GATE: per-card dismissal stays out of v2 (REQ-17-014, REQ-17-023)", () => {
  it("candidate and prune streams offer no dismiss control and write no local storage", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(
      <>
        <ProposalStream kind="candidate-lesson" lessons={[CANDIDATE]} />
        <ProposalStream kind="prune" lessons={[{ ...CANDIDATE, status: "deprecated" }]} />
      </>,
    );
    expect(screen.queryByRole("button", { name: /descartar|ocultar|dismiss/i })).toBeNull();
    expect(setItem).not.toHaveBeenCalled();
  });

  it("a lesson row is one accessible button naming the lesson, opening no copy control of its own", () => {
    render(<ProposalStream kind="prune" lessons={[{ ...CANDIDATE, status: "deprecated" }]} />);
    const row = screen.getByRole("button", { name: /LESSON-0099/ });
    expect(row).toHaveAttribute("type", "button");
    expect(within(row).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Copiar/ })).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively snapshot a directory's file paths + contents for read-only checks. */
function snapshotTree(root: string): string {
  const out: string[] = [];
  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        out.push(`${path.relative(root, full)}:${fs.readFileSync(full, "utf-8")}`);
      }
    }
  }
  walk(root);
  return out.sort().join("\n");
}
