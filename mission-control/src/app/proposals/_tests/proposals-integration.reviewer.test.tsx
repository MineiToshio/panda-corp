/**
 * FRD-17 — REVIEWER adversarial INTEGRATION tests (DR-015 / DR-016).
 *
 * Written by the reviewer (a model distinct from the implementers) at the FRD
 * gate. Unlike the per-WO suites — which mock each reader in isolation — these
 * exercise the work orders TOGETHER through the real pipeline:
 *
 *   factory/memory/*.md  →  readLessons() / candidateLessons() / promotionQueue()
 *   / prunable()  (WO-17-001/002)
 *         →  computeSuggestions() (WO-17-003)
 *         →  the v2 lesson streams (WO-17-008)
 *
 * Focus: the highest-leverage invariant of the whole feature — the DR-047
 * corroboration gate. A single-project candidate lesson whose `source` is
 * malformed/ambiguous (realistic for a hand-authored corpus) must NOT be able
 * to escalate into a `recurring-lesson` promotion suggestion via the over-count
 * bug that twice blocked WO-17-001. This is the integration the per-WO mocked
 * tests cannot catch, because each WO mocks the boundary the bug crosses.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { candidateLessons, promotionQueue, prunable, readLessons } from "@/lib/memory/memory";
import { computeSuggestions } from "@/lib/self-suggest/self-suggest";
import { withFactoryRoot } from "@/tests/fixtures";
import { PromotionsQueuePanel } from "../_components/PromotionsQueuePanel/PromotionsQueuePanel";
import { ProposalStream } from "../_components/ProposalStream/ProposalStream";

// ---------------------------------------------------------------------------
// Temp factory/memory builder
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
});

type LessonFm = Record<string, unknown>;

const BODY = "**Situation:** S.\n\n**Lesson:** L.\n\n**Apply next time:** A.";

function writeLesson(memoryDir: string, filename: string, fm: LessonFm, body = BODY): void {
  const lines: string[] = ["---"];
  for (const [key, val] of Object.entries(fm)) {
    if (Array.isArray(val)) {
      if (val.length === 0) lines.push(`${key}: []`);
      else {
        lines.push(`${key}:`);
        for (const item of val) lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push("---", "", body);
  fs.writeFileSync(path.join(memoryDir, filename), lines.join("\n"), "utf-8");
}

/** Build a temp factory root with a memory dir, returns its path. */
function makeFactory(): { root: string; memoryDir: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mc-frd17-int-"));
  const memoryDir = path.join(root, "factory", "memory");
  fs.mkdirSync(memoryDir, { recursive: true });
  tmpRoots.push(root);
  return { root, memoryDir };
}

// ---------------------------------------------------------------------------
// 1. The DR-047 corroboration gate — end-to-end, reader → self-suggest
// ---------------------------------------------------------------------------

describe("FRD-17 INTEGRATION: a malformed single-project candidate must NOT escalate to a recurring-lesson promotion (DR-047 gate)", () => {
  it("an unclosed-parenthetical source stays awaiting-2nd through readLessons AND produces zero recurring-lesson suggestions", async () => {
    const { root, memoryDir } = makeFactory();
    // Source with an UNCLOSED paren whose inner commas could spawn phantom
    // projects (the exact class that blocked WO-17-001 twice). The lesson is
    // seen in ONLY ONE project; it must never read as ≥2.
    writeLesson(memoryDir, "LESSON-0042.md", {
      id: "LESSON-0042",
      type: "pattern",
      domain: "testing",
      status: "candidate",
      promotion: "none",
      source: '"proj-alpha (note, with comma, proj-beta"',
      links: [],
    });

    const { lessons, suggestions } = await withFactoryRoot(root, () => {
      const all = readLessons();
      const sugg = computeSuggestions({
        boardColumnCounts: {},
        portfolioItems: [],
        events: [],
        capabilities: [],
        decisionRules: [],
        inboxDecisionLines: [],
        lessons: all,
      });
      return { lessons: all, suggestions: sugg };
    });

    const lesson = lessons.find((l) => l.id === "LESSON-0042");
    expect(lesson?.projects).toEqual(["proj-alpha"]);
    expect(lesson?.evalGate).toBe("awaiting-2nd");

    // The integration assertion the per-WO tests cannot make: the over-count,
    // if it regressed, would surface a recurring-lesson card for a 1-project lesson.
    const recurring = suggestions.filter((s) => s.kind === "recurring-lesson");
    expect(recurring).toEqual([]);
  });

  it("trailing free text after a closed paren stays single-project and never reaches the promotion suggestion", async () => {
    const { root, memoryDir } = makeFactory();
    writeLesson(memoryDir, "LESSON-0043.md", {
      id: "LESSON-0043",
      type: "gotcha",
      domain: "testing",
      status: "candidate",
      promotion: "none",
      source: '"proj-alpha (a, b) extra, words here"',
      links: [],
    });

    const recurring = await withFactoryRoot(root, () =>
      computeSuggestions({
        boardColumnCounts: {},
        portfolioItems: [],
        events: [],
        capabilities: [],
        decisionRules: [],
        inboxDecisionLines: [],
        lessons: readLessons(),
      }).filter((s) => s.kind === "recurring-lesson"),
    );

    expect(recurring).toEqual([]);
  });

  it("a GENUINE two-project lesson DOES surface as a recurring-lesson suggestion (the gate is not over-tightened)", async () => {
    const { root, memoryDir } = makeFactory();
    writeLesson(memoryDir, "LESSON-0044.md", {
      id: "LESSON-0044",
      type: "pattern",
      domain: "testing",
      status: "candidate",
      promotion: "none",
      source: '"proj-alpha (WO-01-001), proj-beta (WO-02-003)"',
      links: [],
    });

    const { lesson, recurring } = await withFactoryRoot(root, () => {
      const all = readLessons();
      const sugg = computeSuggestions({
        boardColumnCounts: {},
        portfolioItems: [],
        events: [],
        capabilities: [],
        decisionRules: [],
        inboxDecisionLines: [],
        lessons: all,
      });
      return {
        lesson: all.find((l) => l.id === "LESSON-0044"),
        recurring: sugg.filter((s) => s.kind === "recurring-lesson"),
      };
    });

    expect(lesson?.projects).toEqual(["proj-alpha", "proj-beta"]);
    expect(lesson?.evalGate).toBe("corroborated");
    expect(recurring).toHaveLength(1);
    expect(recurring[0]?.target).toBe("LESSON-0044");
    expect(recurring[0]?.command).toBe("/pandacorp:learn");
  });
});

// ---------------------------------------------------------------------------
// 2. Stream membership — a lesson can be both deprecated AND promotion:proposed
// ---------------------------------------------------------------------------

describe("FRD-17 INTEGRATION: stream membership across the four views", () => {
  it("a deprecated lesson that also carries promotion:proposed lands in BOTH prune and promotion views (no view silently swallows it)", async () => {
    const { root, memoryDir } = makeFactory();
    writeLesson(memoryDir, "LESSON-0050.md", {
      id: "LESSON-0050",
      type: "anti-pattern",
      domain: "testing",
      status: "deprecated",
      promotion: "proposed",
      source: '"proj-x"',
      links: [],
    });

    const { inPrune, inPromo, inCandidate } = await withFactoryRoot(root, () => ({
      inPrune: prunable().some((l) => l.id === "LESSON-0050"),
      inPromo: promotionQueue().some((l) => l.id === "LESSON-0050"),
      inCandidate: candidateLessons().some((l) => l.id === "LESSON-0050"),
    }));

    expect(inPrune).toBe(true);
    expect(inPromo).toBe(true);
    expect(inCandidate).toBe(false); // status is deprecated, not candidate
  });

  it("an active lesson with promotion:none appears in NONE of the proposal views (it is settled, not a proposal)", async () => {
    const { root, memoryDir } = makeFactory();
    writeLesson(memoryDir, "LESSON-0051.md", {
      id: "LESSON-0051",
      type: "pattern",
      domain: "testing",
      status: "active",
      promotion: "none",
      source: '"proj-x"',
      links: [],
    });

    const counts = await withFactoryRoot(root, () => ({
      candidates: candidateLessons().length,
      promo: promotionQueue().length,
      prune: prunable().length,
    }));

    expect(counts).toEqual({ candidates: 0, promo: 0, prune: 0 });
  });
});

// ---------------------------------------------------------------------------
// 3. Read-only invariant — exercising the readers must NEVER mutate the corpus
// ---------------------------------------------------------------------------

describe("FRD-17 INTEGRATION: read-only invariant (FRD non-goal — MC never writes factory/memory)", () => {
  it("readLessons + all derived views + computeSuggestions leave the factory/memory tree byte-identical", async () => {
    const { root, memoryDir } = makeFactory();
    writeLesson(memoryDir, "LESSON-0060.md", {
      id: "LESSON-0060",
      type: "pattern",
      domain: "testing",
      status: "candidate",
      promotion: "proposed",
      source: '"proj-a, proj-b"',
      links: ["DR-047"],
    });
    writeLesson(memoryDir, "_inbox.md", { note: "ignored" }, "raw note line");

    const before = fs
      .readdirSync(memoryDir)
      .map((f) => `${f}:${fs.readFileSync(path.join(memoryDir, f), "utf-8")}`)
      .sort()
      .join("\n");

    await withFactoryRoot(root, () => {
      const all = readLessons();
      candidateLessons();
      promotionQueue();
      prunable();
      computeSuggestions({
        boardColumnCounts: { Documentada: 99 },
        portfolioItems: [],
        events: [],
        capabilities: [],
        decisionRules: [],
        inboxDecisionLines: [],
        lessons: all,
      });
    });

    const after = fs
      .readdirSync(memoryDir)
      .map((f) => `${f}:${fs.readFileSync(path.join(memoryDir, f), "utf-8")}`)
      .sort()
      .join("\n");

    expect(after).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// 4. Page-level render with REAL reader output → streams (WO-17-004 integration)
// ---------------------------------------------------------------------------

describe("FRD-17 INTEGRATION: real reader output renders honestly through the streams (REQ-17-003, REQ-17-009)", () => {
  it("a high-risk promotion (DR-* link) renders display-only — copyable command, no run/submit affordance", async () => {
    const { root, memoryDir } = makeFactory();
    writeLesson(memoryDir, "LESSON-0070.md", {
      id: "LESSON-0070",
      type: "pattern",
      domain: "must-standard",
      status: "active",
      promotion: "proposed",
      source: '"proj-a, proj-b"',
      links: ["DR-001"],
    });

    const promotions = await withFactoryRoot(root, () => promotionQueue());
    expect(promotions).toHaveLength(1);

    render(<PromotionsQueuePanel lessons={promotions} />);
    fireEvent.click(screen.getByRole("button", { name: /LESSON-0070/ }));

    // The exact command is shown and copyable…
    expect(
      screen.getByRole("button", { name: "Copiar /pandacorp:learn LESSON-0070" }),
    ).toBeVisible();

    // …and there is NO affordance that would RUN it (read-only, REQ-17-024).
    expect(
      screen.queryByRole("button", { name: /ejecutar|aplicar|promover|run|aprobar/i }),
    ).toBeNull();
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("an empty corpus renders the calm guild empty-state for every stream — never a blank or fake-urgency screen (REQ-17-008)", async () => {
    const { root } = makeFactory(); // memory dir exists but holds no LESSON-*.md

    const { candidates, promo, prune } = await withFactoryRoot(root, () => ({
      candidates: candidateLessons(),
      promo: promotionQueue(),
      prune: prunable(),
    }));

    render(
      <>
        <PromotionsQueuePanel lessons={promo} />
        <ProposalStream kind="candidate-lesson" lessons={candidates} />
        <ProposalStream kind="prune" lessons={prune} />
      </>,
    );

    // The prune card is drawn only with something prunable (AC-17-001.3).
    expect(screen.queryByRole("heading", { name: /Para podar/ })).toBeNull();
    expect(screen.getByRole("heading", { name: /Esperan tu decisión/ })).toBeVisible();
    expect(screen.getByText("Nada necesita tu decisión ahora.")).toBeVisible();
    // Honest, calm copy — no "urgente"/"ahora mismo"/"!" nagging.
    expect(document.body.textContent ?? "").not.toMatch(/urgente|ahora mismo|inmediatamente/i);
  });
});
