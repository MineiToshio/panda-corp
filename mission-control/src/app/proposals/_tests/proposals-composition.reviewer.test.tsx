/**
 * FRD-17 — REVIEWER composition/integration gate test (DR-015 / DR-050).
 *
 * The per-WO suites verify each component in isolation (MemoryHealth, PromotionsQueue,
 * the dismiss store) and pass green. But the FRD gate must verify the feature WORKS
 * TOGETHER: the EARS criteria say Mission Control SHALL *show* a memory-health panel
 * (REQ-17-005) and SHALL surface a durable promotions queue (REQ-17-006). A component
 * that renders nowhere does not satisfy a "SHALL show" criterion.
 *
 * These tests render the REAL ProposalsPage (with lib readers mocked) and assert the
 * page actually composes:
 *   - the memory-health panel  (CMP-17-health  → REQ-17-005)
 *   - the promotions queue     (CMP-17-promoqueue → REQ-17-006)
 *
 * They are EXPECTED TO FAIL against the current page (which renders only the four
 * ProposalStream sections and orphans MemoryHealth + PromotionsQueue). They are the
 * RED test the rebuild of WO-17-004 must turn GREEN.
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Lesson } from "@/lib/memory/memory";

const PROMOTION_LESSON: Lesson = {
  id: "LESSON-0003",
  type: "library-verdict",
  domain: "testing",
  context: "resumen de una línea de la lección",
  status: "active",
  promotion: "proposed",
  source: "proj-alpha (WO-02-001), proj-beta (WO-03-002)",
  links: ["DR-047"],
  projects: ["proj-alpha", "proj-beta"],
  body: "Use gray-matter with { excerpt: false } to bypass cache.",
  evalGate: "corroborated",
};

vi.mock("@/lib/memory/memory", () => ({
  candidateLessons: vi.fn(() => []),
  promotionQueue: vi.fn(() => [PROMOTION_LESSON]),
  prunable: vi.fn(() => []),
}));

vi.mock("@/lib/memory/memory-health", () => ({
  memoryHealth: vi.fn(() => ({
    rawNotes: 12,
    candidates: 1,
    lastMemoryRunAt: "2026-06-10T00:00:00.000Z",
    staleDays: 8,
  })),
}));

vi.mock("@/lib/self-suggest/self-suggest", () => ({
  computeSuggestions: vi.fn(() => []),
}));

async function renderPage(): Promise<void> {
  const { default: ProposalsPage } = await import("../page");
  render(<ProposalsPage />);
}

describe("FRD-17 gate: the proposals page composes the full feature surface", () => {
  it("renders the memory-health panel on the page (REQ-17-005 — SHALL show)", async () => {
    await renderPage();
    expect(screen.queryByTestId("memory-health-panel")).not.toBeNull();
  });

  it("renders the durable promotions queue on the page (REQ-17-006 — SHALL show)", async () => {
    await renderPage();
    expect(screen.queryByTestId("promotions-queue")).not.toBeNull();
  });
});
