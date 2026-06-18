/**
 * WO-02-009 — actions.ts tests (TDD: RED → GREEN → refactor).
 *
 * Tests the discardIdeaAction Server Action which delegates to lib/discard.ts
 * and revalidates the board path.
 *
 * Traceability:
 *   CMP-02-discard-action → REQ-02-007
 *   AC-02-007.1 — WHEN the owner presses "Discard idea", the system SHALL rewrite
 *                 `status: discarded` in the `.md` frontmatter.
 *
 * Stack: Vitest (Node environment — Server Action has no DOM needs).
 *
 * Mocks:
 *   - lib/discard (discardIdea) — we test the action delegates correctly.
 *   - next/cache (revalidatePath) — we verify it is called on success.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock lib/discard before importing the action
// ---------------------------------------------------------------------------

vi.mock("@/lib/discard", () => ({
  discardIdea: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { discardIdea } from "@/lib/discard";
// After mocking, import the action and its dependencies.
import { discardIdeaAction } from "./actions";

const mockDiscardIdea = vi.mocked(discardIdea);
const mockRevalidatePath = vi.mocked(revalidatePath);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("discardIdeaAction — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls discardIdea with the provided slug", async () => {
    mockDiscardIdea.mockReturnValue({ ok: true });
    await discardIdeaAction("idea-discovered");
    expect(mockDiscardIdea).toHaveBeenCalledWith("idea-discovered");
  });

  it("calls discardIdea exactly once per invocation", async () => {
    mockDiscardIdea.mockReturnValue({ ok: true });
    await discardIdeaAction("idea-any");
    expect(mockDiscardIdea).toHaveBeenCalledTimes(1);
  });

  it("revalidates the board path on success", async () => {
    mockDiscardIdea.mockReturnValue({ ok: true });
    await discardIdeaAction("idea-discovered");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/board");
  });

  it("returns { ok: true } when discardIdea returns { ok: true }", async () => {
    mockDiscardIdea.mockReturnValue({ ok: true });
    const result = await discardIdeaAction("idea-discovered");
    expect(result).toEqual({ ok: true });
  });
});

describe("discardIdeaAction — not-found error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { ok: false, reason: 'not-found' } when discardIdea returns not-found", async () => {
    mockDiscardIdea.mockReturnValue({ ok: false, reason: "not-found" });
    const result = await discardIdeaAction("slug-missing");
    expect(result).toEqual({ ok: false, reason: "not-found" });
  });

  it("does NOT revalidate the board path on not-found failure", async () => {
    mockDiscardIdea.mockReturnValue({ ok: false, reason: "not-found" });
    await discardIdeaAction("slug-missing");
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("discardIdeaAction — parse-error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns { ok: false, reason: 'parse-error' } when discardIdea returns parse-error", async () => {
    mockDiscardIdea.mockReturnValue({ ok: false, reason: "parse-error" });
    const result = await discardIdeaAction("idea-malformed");
    expect(result).toEqual({ ok: false, reason: "parse-error" });
  });

  it("does NOT revalidate the board path on parse-error failure", async () => {
    mockDiscardIdea.mockReturnValue({ ok: false, reason: "parse-error" });
    await discardIdeaAction("idea-malformed");
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("does not throw even when discardIdea returns { ok: false }", async () => {
    mockDiscardIdea.mockReturnValue({ ok: false, reason: "parse-error" });
    await expect(discardIdeaAction("idea-malformed")).resolves.not.toThrow();
  });
});

describe("discardIdeaAction — only write via lib/discard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not add any other write beside calling discardIdea", async () => {
    // If the action calls discardIdea and nothing else writes, the action itself
    // is pure delegation. We verify the mock is the only write path.
    mockDiscardIdea.mockReturnValue({ ok: true });
    await discardIdeaAction("idea-any");
    // The only write-related call is discardIdea — revalidatePath is a cache hint, not a write.
    expect(mockDiscardIdea).toHaveBeenCalledTimes(1);
    expect(mockRevalidatePath).toHaveBeenCalledTimes(1);
  });
});
