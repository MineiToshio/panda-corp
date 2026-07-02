/**
 * WO-17-004 — REQ-17-001 group-level command + lesson grouping (RED phase)
 *
 * Tests that:
 *   AC-17-001.1 — group-level command shown ONCE under the group title when all
 *                 items in the group share a single skill; no per-item command
 *   AC-17-001.2 — per-item command only when its command genuinely differs
 *                 (promotions / self-suggestions); candidates+prune cards carry NO command
 *   AC-17-001.3 — lesson groups adjacent and first: candidates → prune → promotions → self-suggestions
 *
 * Also covers:
 *   AC-17-004.1 — four groups all rendered
 *   AC-17-004.2 — evidence + suggested action + exact command (at group level for candidates/prune)
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CANDIDATE: Lesson = {
  id: "LESSON-0001",
  type: "gotcha",
  domain: "nextjs",
  context: "resumen de una línea de la lección",
  status: "candidate",
  promotion: "none",
  source: "proj-alpha (WO-01-001)",
  links: [],
  projects: ["proj-alpha"],
  body: "Candidate body.",
  trigger: "",
  appliedIn: [],
  evalGate: "awaiting-2nd",
};

const PRUNE: Lesson = {
  id: "LESSON-0009",
  type: "anti-pattern",
  domain: "ci",
  context: "resumen de una línea de la lección",
  status: "deprecated",
  promotion: "none",
  source: "proj-alpha (WO-01-001)",
  links: [],
  projects: ["proj-alpha"],
  body: "Deprecated.",
  trigger: "",
  appliedIn: [],
  evalGate: "corroborated",
};

const PROMOTION: Lesson = {
  id: "LESSON-0031",
  type: "library-verdict",
  domain: "web-performance",
  context: "resumen de una línea de la lección",
  status: "active",
  promotion: "proposed",
  source: "proj-alpha (WO-02-001), proj-beta (WO-03-002)",
  links: [],
  projects: ["proj-alpha", "proj-beta"],
  body: "next/font prevents CLS.",
  trigger: "",
  appliedIn: [],
  evalGate: "corroborated",
};

const SUGGESTION: Suggestion = {
  kind: "velocity",
  title: "«recipe-keeper» lleva 6 días en Arquitectura",
  evidence: "La norma del portfolio son ~2 días",
  command: "/pandacorp:decide",
  target: "recipe-keeper",
  severity: "nudge",
};

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

vi.mock("@/lib/memory/memory", () => ({
  candidateLessons: vi.fn(),
  promotionQueue: vi.fn(),
  prunable: vi.fn(),
  readLessons: vi.fn(() => []),
}));

vi.mock("@/lib/memory/memory-health", () => ({
  memoryHealth: vi.fn(() => ({
    rawNotes: 0,
    candidates: 0,
    lastMemoryRunAt: null,
    staleDays: null,
    lastSweepAt: null,
    harvestOrphans: [],
  })),
}));

vi.mock("@/lib/self-suggest/self-suggest", () => ({
  computeSuggestions: vi.fn(),
}));

async function importMocks() {
  const memory = await import("@/lib/memory/memory");
  const selfSuggest = await import("@/lib/self-suggest/self-suggest");
  return { memory, selfSuggest };
}

async function importPage() {
  const mod = await import("../page");
  return mod.default;
}

// ---------------------------------------------------------------------------
// AC-17-001.1 — group-level command shown once per group
// ---------------------------------------------------------------------------

describe("REQ-17-001 / AC-17-001.1 — group-level command once per group", () => {
  it("candidate-lesson group shows a group-level /pandacorp:memory command row", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    // The group-level command must contain /pandacorp:memory
    const candidateStream = screen.getByTestId("proposal-stream-candidate-lesson");
    const groupCmd = within(candidateStream).getByTestId("group-level-command");
    expect(groupCmd).toBeInTheDocument();
    expect(groupCmd.textContent).toContain("/pandacorp:memory");
  });

  it("prune group shows a group-level /pandacorp:memory command row", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([PRUNE]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const pruneStream = screen.getByTestId("proposal-stream-prune");
    const groupCmd = within(pruneStream).getByTestId("group-level-command");
    expect(groupCmd).toBeInTheDocument();
    expect(groupCmd.textContent).toContain("/pandacorp:memory");
  });
});

// ---------------------------------------------------------------------------
// AC-17-001.2 — per-item command only when group differs
// ---------------------------------------------------------------------------

describe("REQ-17-001 / AC-17-001.2 — per-item command only when group differs", () => {
  it("candidate-lesson cards carry NO per-card command (deferred to group level)", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const candidateStream = screen.getByTestId("proposal-stream-candidate-lesson");
    const card = within(candidateStream).getByTestId("proposal-card");
    // Card must have NO per-card cmd-row when the group provides the command
    expect(within(card).queryByTestId("proposal-card-command")).toBeNull();
  });

  it("prune cards carry NO per-card command (deferred to group level)", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([PRUNE]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const pruneStream = screen.getByTestId("proposal-stream-prune");
    const card = within(pruneStream).getByTestId("proposal-card");
    expect(within(card).queryByTestId("proposal-card-command")).toBeNull();
  });

  it("each promotion in the queue carries its own /pandacorp:learn command", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([PROMOTION]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    // Promotions are the durable PromotionsQueue now (DR-103 dedup) — each entry
    // carries its own /pandacorp:learn <id> command.
    const queue = screen.getByTestId("promotions-queue");
    const cmd = within(queue).getByTestId("promotion-learn-command");
    expect(cmd.textContent).toContain("/pandacorp:learn");
  });

  it("self-suggestion cards carry a per-card command (each differs)", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([SUGGESTION]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const selfStream = screen.getByTestId("proposal-stream-self-suggestion");
    const card = within(selfStream).getByTestId("proposal-card");
    const cardCmd = within(card).getByTestId("proposal-card-command");
    expect(cardCmd).toBeInTheDocument();
  });

  it("promotions queue has NO group-level command (each promotion is its own /pandacorp:learn)", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([PROMOTION]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const queue = screen.getByTestId("promotions-queue");
    expect(within(queue).queryByTestId("group-level-command")).toBeNull();
  });

  it("self-suggestion stream has NO group-level command", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([SUGGESTION]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const selfStream = screen.getByTestId("proposal-stream-self-suggestion");
    expect(within(selfStream).queryByTestId("group-level-command")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// AC-17-001.3 — lesson groups adjacent and first
// ---------------------------------------------------------------------------

describe("REQ-17-001 / AC-17-001.3 — lesson groups adjacent, candidates before prune", () => {
  it("candidate stream appears before prune stream in the document", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([PROMOTION]);
    vi.mocked(memory.prunable).mockReturnValue([PRUNE]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([SUGGESTION]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const candidateEl = screen.getByTestId("proposal-stream-candidate-lesson");
    const pruneEl = screen.getByTestId("proposal-stream-prune");

    // compareDocumentPosition: FOLLOWING = 4 means candidateEl comes before pruneEl
    const pos = candidateEl.compareDocumentPosition(pruneEl);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("prune stream appears before the promotions queue in the document", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([PROMOTION]);
    vi.mocked(memory.prunable).mockReturnValue([PRUNE]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([SUGGESTION]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const pruneEl = screen.getByTestId("proposal-stream-prune");
    const queueEl = screen.getByTestId("promotions-queue");

    const pos = pruneEl.compareDocumentPosition(queueEl);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("promotions queue appears before self-suggestion stream in the document", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([PROMOTION]);
    vi.mocked(memory.prunable).mockReturnValue([PRUNE]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([SUGGESTION]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const queueEl = screen.getByTestId("promotions-queue");
    const selfEl = screen.getByTestId("proposal-stream-self-suggestion");

    const pos = queueEl.compareDocumentPosition(selfEl);
    expect(pos & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Visual structure — PageTitle and SectionHead used on the proposals page
// ---------------------------------------------------------------------------

describe("Visual structure — canonical primitives used", () => {
  it("proposals page uses PageTitle (data-testid=page-title) not a bespoke header", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    // PageTitle always sets data-testid="page-title"
    expect(screen.getByTestId("page-title")).toBeInTheDocument();
  });

  it("proposal stream group uses SectionHead (data-testid=section-head) as section divider", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    // SectionHead renders data-testid="section-head"
    const sectionHeads = screen.getAllByTestId("section-head");
    expect(sectionHeads.length).toBeGreaterThan(0);
  });

  it("ProposalCard uses rpgpanel variant (data-testid=panel with data-variant=rpgpanel)", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const candidateStream = screen.getByTestId("proposal-stream-candidate-lesson");
    const panels = within(candidateStream).getAllByTestId("panel");
    expect(panels.length).toBeGreaterThan(0);
    expect(panels[0]).toHaveAttribute("data-variant", "rpgpanel");
  });
});
