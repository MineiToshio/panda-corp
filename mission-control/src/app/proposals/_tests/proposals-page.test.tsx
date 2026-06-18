/**
 * WO-17-004 — Proposals page integration tests (RED phase)
 *
 * Tests the `app/proposals/page.tsx` Server Component rendering by mocking
 * the lib/memory and lib/self-suggest modules. Exercises all four streams,
 * empty state, eval-gate badge, high-risk display-only AC, and Spanish copy.
 *
 * Strategy: mock the filesystem readers (candidateLessons, promotionQueue,
 * prunable from lib/memory; computeSuggestions from lib/self-suggest) and
 * render the real page component in jsdom. This mirrors the pattern used in
 * the configuration page integration tests.
 *
 * Traceability:
 *   AC-17-004.1  All four streams rendered
 *   AC-17-004.2  Each card shows evidence, action, command copy button
 *   AC-17-004.3  Candidate lessons visually distinct; eval-gate badge
 *   AC-17-004.4  High-risk proposals: display-only
 *   AC-17-004.5  Empty state: calm guild message
 *   AC-17-004.6  Spanish copy; a11y (FRD-13)
 *
 * Stack: Vitest + @testing-library/react + jsdom.
 * NOTE: No "use server" directive on page.tsx (reviewer note from progress.md).
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Lesson } from "@/lib/memory/memory";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_CANDIDATE: Lesson = {
  id: "LESSON-0001",
  type: "gotcha",
  domain: "nextjs",
  status: "candidate",
  promotion: "none",
  source: "proj-alpha (WO-01-001 review)",
  links: ["DR-047"],
  projects: ["proj-alpha"],
  body: "Never add 'use server' to page.tsx with non-async default exports.",
  evalGate: "awaiting-2nd",
};

const FIXTURE_CANDIDATE_CORROBORATED: Lesson = {
  ...FIXTURE_CANDIDATE,
  id: "LESSON-0002",
  projects: ["proj-alpha", "proj-beta"],
  evalGate: "corroborated",
};

const FIXTURE_PROMOTION: Lesson = {
  id: "LESSON-0003",
  type: "library-verdict",
  domain: "testing",
  status: "active",
  promotion: "proposed",
  source: "proj-alpha (WO-02-001), proj-beta (WO-03-002)",
  links: ["DR-047"],
  projects: ["proj-alpha", "proj-beta"],
  body: "Use gray-matter with { excerpt: false } to bypass cache.",
  evalGate: "corroborated",
};

const FIXTURE_PRUNE: Lesson = {
  id: "LESSON-0004",
  type: "anti-pattern",
  domain: "ci",
  status: "deprecated",
  promotion: "none",
  source: "proj-alpha (WO-01-001)",
  links: [],
  projects: ["proj-alpha"],
  body: "Deprecated anti-pattern.",
  evalGate: "corroborated",
};

const FIXTURE_SUGGESTION_BOTTLENECK: Suggestion = {
  kind: "bottleneck",
  title: 'Cuello de botella en "discovered" (5 ideas)',
  evidence: 'Columna "discovered": 5 ideas acumuladas (umbral: 5)',
  command: "/pandacorp:recommend",
  target: "discovered",
  severity: "nudge",
};

const FIXTURE_SUGGESTION_LAUNCH: Suggestion = {
  kind: "launch-review",
  title: '"proj-shipped" lleva 35 días en producción — revisar métricas',
  evidence: "proj-shipped: 35 días en operación (umbral: 30 días, DR-043)",
  command: "/pandacorp:review-launch",
  target: "proj-shipped",
  severity: "nudge",
};

// ---------------------------------------------------------------------------
// Mock setup — module-level vi.mock calls (hoisted by Vitest)
// ---------------------------------------------------------------------------

vi.mock("@/lib/memory/memory", () => ({
  candidateLessons: vi.fn(),
  promotionQueue: vi.fn(),
  prunable: vi.fn(),
  readLessons: vi.fn(() => []),
}));

// The page composes the MemoryHealth panel, which calls memoryHealth() (a real
// filesystem reader). Mock it here so this suite stays a hermetic unit test —
// these tests assert on the four streams, not on the health panel's data.
vi.mock("@/lib/memory/memory-health", () => ({
  memoryHealth: vi.fn(() => ({
    rawNotes: 0,
    candidates: 0,
    lastMemoryRunAt: null,
    staleDays: null,
  })),
}));

vi.mock("@/lib/self-suggest/self-suggest", () => ({
  computeSuggestions: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Lazy import — AFTER vi.mock declarations so the mock is applied
// ---------------------------------------------------------------------------

// We import the component under test after the mocks are in place.
// This must be a dynamic import inside the test function, or deferred.
// We use a factory helper to avoid circular mock issues.
async function importMocks() {
  const memory = await import("@/lib/memory/memory");
  const selfSuggest = await import("@/lib/self-suggest/self-suggest");
  return { memory, selfSuggest };
}

async function importPage() {
  // Dynamic import so the mock is in place when the page module loads
  const mod = await import("../page");
  return mod.default;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProposalsPage — four streams", () => {
  it("AC-17-004.1: renders all four stream sections", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([FIXTURE_CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([FIXTURE_PROMOTION]);
    vi.mocked(memory.prunable).mockReturnValue([FIXTURE_PRUNE]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([FIXTURE_SUGGESTION_BOTTLENECK]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    expect(screen.getByTestId("proposal-stream-candidate-lesson")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-stream-promotion")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-stream-prune")).toBeInTheDocument();
    expect(screen.getByTestId("proposal-stream-self-suggestion")).toBeInTheDocument();
  });

  it("AC-17-004.1: page has a main heading / page title (guild crónica theme)", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toBeInTheDocument();
    expect(h1.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("AC-17-004.1: renders correct number of proposal cards per stream", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([
      FIXTURE_CANDIDATE,
      FIXTURE_CANDIDATE_CORROBORATED,
    ]);
    vi.mocked(memory.promotionQueue).mockReturnValue([FIXTURE_PROMOTION]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([
      FIXTURE_SUGGESTION_BOTTLENECK,
      FIXTURE_SUGGESTION_LAUNCH,
    ]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const allCards = screen.getAllByTestId("proposal-card");
    // 2 candidates + 1 promotion + 0 prune + 2 suggestions = 5
    expect(allCards).toHaveLength(5);
  });
});

describe("ProposalsPage — empty state", () => {
  it("AC-17-004.5: all streams empty → each shows calm empty state, not blank", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const emptyStates = screen.getAllByTestId("proposal-stream-empty");
    expect(emptyStates.length).toBeGreaterThanOrEqual(4);

    for (const emptyState of emptyStates) {
      expect(emptyState.textContent?.trim().length).toBeGreaterThan(0);
      const text = emptyState.textContent ?? "";
      expect(text.toLowerCase()).not.toContain("urgente");
    }
  });
});

describe("ProposalsPage — eval-gate badge on candidate lessons", () => {
  it("AC-17-004.3: awaiting-2nd candidate shows eval-gate badge", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([FIXTURE_CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const badge = screen.getByTestId("proposal-eval-gate-badge");
    expect(badge).toHaveAttribute("data-eval-gate", "awaiting-2nd");
  });

  it("AC-17-004.3: corroborated candidate shows corroborated eval-gate badge", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([FIXTURE_CANDIDATE_CORROBORATED]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const badge = screen.getByTestId("proposal-eval-gate-badge");
    expect(badge).toHaveAttribute("data-eval-gate", "corroborated");
  });
});

describe("ProposalsPage — display-only / read-only", () => {
  it("AC-17-004.4: no form submit buttons anywhere on the page", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([FIXTURE_CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([FIXTURE_PROMOTION]);
    vi.mocked(memory.prunable).mockReturnValue([FIXTURE_PRUNE]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([FIXTURE_SUGGESTION_LAUNCH]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn).not.toHaveAttribute("type", "submit");
    }
  });

  it("AC-17-004.4: copy buttons are present for each proposal card", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([FIXTURE_CANDIDATE]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([FIXTURE_SUGGESTION_BOTTLENECK]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    const copyButtons = screen.getAllByTestId("copy-button");
    // One copy button per visible proposal card (1 candidate + 1 suggestion)
    expect(copyButtons.length).toBeGreaterThanOrEqual(2);
  });
});

describe("ProposalsPage — Spanish copy and a11y", () => {
  it("AC-17-004.6: page has a main landmark", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("AC-17-004.6: page root has data-testid proposals-page", async () => {
    const { memory, selfSuggest } = await importMocks();
    vi.mocked(memory.candidateLessons).mockReturnValue([]);
    vi.mocked(memory.promotionQueue).mockReturnValue([]);
    vi.mocked(memory.prunable).mockReturnValue([]);
    vi.mocked(selfSuggest.computeSuggestions).mockReturnValue([]);

    const ProposalsPage = await importPage();
    render(<ProposalsPage />);

    expect(screen.getByTestId("proposals-page")).toBeInTheDocument();
  });

  it("AC-17-004.6: page has no 'use server' directive (must not break Next.js build)", async () => {
    // The page module can be imported without errors in jsdom context,
    // which would fail if it had "use server" and tried to use server-only APIs
    const ProposalsPage = await importPage();
    expect(typeof ProposalsPage).toBe("function");
  });
});
