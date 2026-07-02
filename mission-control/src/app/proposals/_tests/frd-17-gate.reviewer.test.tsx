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
 *         →  DismissableProposalStream + ProposalCard  (WO-17-004 / WO-17-007)
 *
 * Focus (gaps in the existing suites):
 *   1. The whole gather→compute wiring is fail-soft AND read-only against a REAL
 *      temp factory (the existing wiring test mocks computeSuggestions away, so
 *      gather.ts itself was never exercised end-to-end at the gate).
 *   2. A genuine bottleneck assembled from real board cards surfaces a real
 *      self-suggestion through the live readers — proving the 5 wired derivations
 *      are not dead in production (REQ-17-004), not just "inputs non-empty".
 *   3. Dismiss is not just present but FUNCTIONAL: clicking it removes the card
 *      and the dismissal is remembered (REQ-17-008 / AC-17-007.3) — exercised on
 *      the real DismissableProposalStream, not a mock.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import { gatherSuggestionsInput } from "@/lib/self-suggest/gather";
import { computeSuggestions } from "@/lib/self-suggest/self-suggest";
import { withFactoryRoot } from "@/tests/fixtures";
import { DismissableProposalStream } from "../_components/DismissableProposalStream/DismissableProposalStream";

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
// 3. Dismiss is FUNCTIONAL end-to-end on the real DismissableProposalStream
//    (REQ-17-008 / AC-17-007.3) — clicking removes the card AND is remembered
// ---------------------------------------------------------------------------

const DISMISSABLE_LESSON: Lesson = {
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

describe("FRD-17 GATE: dismissing a proposal removes it and is remembered (REQ-17-008 / AC-17-007.3)", () => {
  it("clicking Descartar removes the card from the stream", () => {
    render(<DismissableProposalStream kind="candidate-lesson" lessons={[DISMISSABLE_LESSON]} />);

    // The card is visible with its dismiss affordance.
    expect(screen.getByTestId("proposal-card")).toBeInTheDocument();
    const dismiss = screen.getByRole("button", { name: /descartar propuesta: LESSON-0099/i });

    fireEvent.click(dismiss);

    // The card is gone, replaced by the calm empty state — not a blank screen.
    expect(screen.queryByTestId("proposal-card")).toBeNull();
    expect(screen.getByTestId("proposal-stream-empty")).toBeInTheDocument();
  });

  it("a previously-dismissed proposal never flashes in on remount (the dismissal is remembered)", () => {
    const { unmount } = render(
      <DismissableProposalStream kind="candidate-lesson" lessons={[DISMISSABLE_LESSON]} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /descartar propuesta: LESSON-0099/i }));
    expect(screen.queryByTestId("proposal-card")).toBeNull();
    unmount();

    // Remount with the SAME lesson still in the source list (the factory never
    // changed — dismissal is client-local). The card must stay hidden.
    render(<DismissableProposalStream kind="candidate-lesson" lessons={[DISMISSABLE_LESSON]} />);
    expect(screen.queryByTestId("proposal-card")).toBeNull();
    expect(screen.getByTestId("proposal-stream-empty")).toBeInTheDocument();
  });

  it("the dismiss button is an accessible <button>, not a color-only affordance (a11y, FRD-13)", () => {
    render(<DismissableProposalStream kind="candidate-lesson" lessons={[DISMISSABLE_LESSON]} />);
    const dismiss = screen.getByTestId("proposal-dismiss-button");
    expect(dismiss.tagName).toBe("BUTTON");
    expect(dismiss).toHaveAttribute("type", "button");
    // The affordance carries a text label, not color/icon alone.
    expect(dismiss).toHaveAccessibleName(/descartar/i);
    // It sits beside (not inside) the card, so the card's own copy button is not
    // nested under the dismiss control.
    const row = dismiss.parentElement;
    expect(row).not.toBeNull();
    if (row) {
      const cardCopy = within(row).queryAllByTestId("copy-button");
      // The dismiss button itself contains no copy button.
      expect(within(dismiss).queryByTestId("copy-button")).toBeNull();
      void cardCopy;
    }
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
