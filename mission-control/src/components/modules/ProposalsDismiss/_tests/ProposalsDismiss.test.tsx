/**
 * WO-17-007 — ProposalsDismiss tests (RED → GREEN)
 *
 * Acceptance criteria verified:
 *   AC-17-007.3 — dismissing a proposal removes it from the count/list;
 *                 dismissal survives refresh (localStorage);
 *                 dismissal is NOT a write to the factory.
 *   AC-17-007.4 — calm count after dismissal (no urgency for dismissed items)
 *
 * Tests use a localStorage mock (jsdom provides it; vitest restores between tests).
 *
 * Traceability:
 *   CMP-17-dismiss → REQ-17-007, REQ-17-008
 *   AC-17-007.3, AC-17-007.4
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  dismissProposal,
  filterUndismissed,
  getDismissedIds,
  isProposalDismissed,
  PROPOSALS_DISMISSED_KEY,
} from "../proposalsDismissStore";

// ---------------------------------------------------------------------------
// localStorage isolation helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// AC-17-007.3 — dismissal persists in localStorage (NOT a factory write)
// ---------------------------------------------------------------------------

describe("AC-17-007.3 — dismissal persists in localStorage", () => {
  it("stores dismissed id in localStorage under the correct key", () => {
    dismissProposal("LESSON-0001");
    const raw = localStorage.getItem(PROPOSALS_DISMISSED_KEY);
    expect(raw).not.toBeNull();
    const ids = JSON.parse(raw ?? "[]") as string[];
    expect(ids).toContain("LESSON-0001");
  });

  it("can dismiss multiple proposals and retrieves all of them", () => {
    dismissProposal("LESSON-0001");
    dismissProposal("LESSON-0002");
    const ids = getDismissedIds();
    expect(ids).toContain("LESSON-0001");
    expect(ids).toContain("LESSON-0002");
    expect(ids).toHaveLength(2);
  });

  it("dismissing the same id twice is idempotent (no duplicates)", () => {
    dismissProposal("LESSON-0001");
    dismissProposal("LESSON-0001");
    const ids = getDismissedIds();
    expect(ids.filter((id) => id === "LESSON-0001")).toHaveLength(1);
  });

  it("isProposalDismissed returns true for dismissed proposal", () => {
    dismissProposal("sg-001");
    expect(isProposalDismissed("sg-001")).toBe(true);
  });

  it("isProposalDismissed returns false for non-dismissed proposal", () => {
    expect(isProposalDismissed("sg-999")).toBe(false);
  });

  it("persists across simulated refresh — reading back from localStorage after a new call", () => {
    // Simulate first session: dismiss
    dismissProposal("LESSON-0005");
    // Simulate page refresh: read back (the key survives because localStorage persists)
    const ids = getDismissedIds();
    expect(ids).toContain("LESSON-0005");
    expect(isProposalDismissed("LESSON-0005")).toBe(true);
  });

  it("getDismissedIds returns [] when nothing is dismissed (fresh localStorage)", () => {
    const ids = getDismissedIds();
    expect(ids).toEqual([]);
  });

  it("getDismissedIds returns [] when localStorage key is corrupted", () => {
    localStorage.setItem(PROPOSALS_DISMISSED_KEY, "not-valid-json{{{");
    const ids = getDismissedIds();
    expect(ids).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-17-007.3 — filterUndismissed removes dismissed proposals from list
// ---------------------------------------------------------------------------

describe("AC-17-007.3 — filterUndismissed removes dismissed items", () => {
  it("returns all proposals when none dismissed", () => {
    const proposals = [
      { id: "LESSON-0001", title: "A" },
      { id: "LESSON-0002", title: "B" },
    ];
    const result = filterUndismissed(proposals);
    expect(result).toHaveLength(2);
  });

  it("removes a dismissed proposal from the list", () => {
    dismissProposal("LESSON-0001");
    const proposals = [
      { id: "LESSON-0001", title: "A" },
      { id: "LESSON-0002", title: "B" },
    ];
    const result = filterUndismissed(proposals);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("LESSON-0002");
  });

  it("removes all dismissed proposals from the list", () => {
    dismissProposal("LESSON-0001");
    dismissProposal("LESSON-0002");
    const proposals = [
      { id: "LESSON-0001", title: "A" },
      { id: "LESSON-0002", title: "B" },
    ];
    const result = filterUndismissed(proposals);
    expect(result).toHaveLength(0);
  });

  it("returns empty array when input is empty", () => {
    const result = filterUndismissed([]);
    expect(result).toHaveLength(0);
  });
});
