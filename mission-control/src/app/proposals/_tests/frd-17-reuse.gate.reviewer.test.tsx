/**
 * FRD-17 — REVIEWER FRD-GATE adversarial reuse test (DR-057 / DR-062, DR-015).
 *
 * Written at the FRD gate by a model distinct from the implementers (opus vs the
 * sonnet/haiku worker). SAME defect class that rejected FRD-05/07/08/10 this run:
 * the proposals surface FORKS its own bespoke primitives instead of REUSING the
 * ONE shared design-system component each surface is contractually required to use.
 *
 * The WO-17-004 Scope, the FDD (§2/§5) and the living inventory (docs/design/
 * components.md L34/L137/L138) are all explicit:
 *   - MemoryHealthPanel staleness nudge → the shared `Banner` ("no second banner");
 *     its header → the shared `SectionHead` ("no bespoke per-screen section header").
 *   - PromotionsQueue header → `SectionHead`; its entry cards → `Panel`;
 *     its risk/state badges → `Chip`.
 *   - ProposalsBadge count pill → `CountBadge` ("consumer of CountBadge/Chip,
 *     NOT a new pill").
 *
 * Each shared primitive stamps a canonical data-testid (banner / section-head /
 * count-badge / panel / chip). A FORK that re-implements the look with private
 * <div>/<h2>/<span> styles emits NONE of them — so these assertions are RED
 * against the current fork and GREEN only once the canonical primitive is
 * composed. They are mutation-killing: a hand-rolled banner cannot stamp
 * data-testid="banner".
 *
 * Traceability: DR-057 (reuse-before-create), DR-062 (one cohesive app),
 * WO-17-004 Scope, FDD-17 §4/§5, components.md L34/L137/L138.
 */

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MemoryHealth } from "@/components/modules/MemoryHealth/MemoryHealth";
import { PromotionsQueue } from "@/components/modules/PromotionsQueue/PromotionsQueue";
import { ProposalsBadge } from "@/components/modules/ProposalsBadge/ProposalsBadge";
import type { Lesson } from "@/lib/memory/memory";
import type { MemoryHealth as MemoryHealthData } from "@/lib/memory/memory-health";

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* jsdom may not expose it */
  }
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A health bag whose thresholds force the staleness nudge to render. */
const STALE_HEALTH: MemoryHealthData = {
  rawNotes: 12,
  candidates: 3,
  lastMemoryRunAt: "2026-05-01T10:00:00Z",
  staleDays: 51,
};

const PROPOSED_LESSON: Lesson = {
  id: "LESSON-0031",
  type: "pattern",
  domain: "web-performance",
  status: "active",
  promotion: "proposed",
  source: "quick-notes · Pandacorp · recipe-keeper",
  links: ["DR-052"],
  projects: ["quick-notes", "Pandacorp", "recipe-keeper"],
  body: "**Situation:** next/font avoids CLS.\n\n**Lesson:** fix it as a standard.",
  evalGate: "corroborated",
};

// ---------------------------------------------------------------------------
// 1. MemoryHealthPanel — staleness nudge MUST be the shared Banner (DR-057)
// ---------------------------------------------------------------------------

describe("FRD-17 GATE (DR-057): MemoryHealthPanel reuses the shared Banner + SectionHead, not a fork", () => {
  it("the staleness nudge is the shared Banner (data-testid='banner'), not a bespoke <div>", () => {
    render(<MemoryHealth health={STALE_HEALTH} />);
    // The shared Banner stamps data-testid="banner". A forked nudge <div> does not.
    expect(screen.getByTestId("banner")).toBeInTheDocument();
  });

  it("the panel header is the shared SectionHead (data-testid='section-head'), not a bespoke heading", () => {
    render(<MemoryHealth health={STALE_HEALTH} />);
    expect(screen.getByTestId("section-head")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 2. PromotionsQueue — header = SectionHead, cards = Panel, badges = Chip
// ---------------------------------------------------------------------------

describe("FRD-17 GATE (DR-057): PromotionsQueue reuses SectionHead + Panel + Chip, not forks", () => {
  it("the queue header is the shared SectionHead, not a bespoke <h2>", () => {
    render(<PromotionsQueue lessons={[PROPOSED_LESSON]} />);
    expect(screen.getByTestId("section-head")).toBeInTheDocument();
  });

  it("each promotion entry is rendered on the shared Panel (data-testid='panel')", () => {
    render(<PromotionsQueue lessons={[PROPOSED_LESSON]} />);
    expect(screen.getAllByTestId("panel").length).toBeGreaterThan(0);
  });

  it("the high-risk / state badge is the shared Chip (data-testid='chip'), not a bespoke <span>", () => {
    render(<PromotionsQueue lessons={[PROPOSED_LESSON]} />);
    expect(screen.getAllByTestId("chip").length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 3. ProposalsBadge — count pill MUST be the shared CountBadge (DR-057)
// ---------------------------------------------------------------------------

describe("FRD-17 GATE (DR-057): ProposalsBadge reuses the shared CountBadge, not a forked pill", () => {
  it("the open-count pill is the shared CountBadge (data-testid='count-badge'), not a bespoke <span>", () => {
    render(<ProposalsBadge openCount={4} />);
    expect(screen.getByTestId("count-badge")).toBeInTheDocument();
  });
});
