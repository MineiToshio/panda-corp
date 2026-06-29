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

vi.mock("@/lib/discard/discard", () => ({
  discardIdea: vi.fn(),
}));

vi.mock("@/lib/discard/restore", () => ({
  restoreIdea: vi.fn(),
}));

vi.mock("@/lib/favorite/favorite", () => ({
  setFavorite: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { discardIdea } from "@/lib/discard/discard";
import { restoreIdea } from "@/lib/discard/restore";
import { setFavorite } from "@/lib/favorite/favorite";
// After mocking, import the action and its dependencies.
import { discardIdeaAction, restoreIdeaAction, toggleFavoriteAction } from "../actions";

const mockDiscardIdea = vi.mocked(discardIdea);
const mockRestoreIdea = vi.mocked(restoreIdea);
const mockSetFavorite = vi.mocked(setFavorite);
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
    // ideasDir omitted (undefined) in production; no reason given → undefined.
    expect(mockDiscardIdea).toHaveBeenCalledWith("idea-discovered", undefined, undefined);
  });

  it("forwards the discard reason to discardIdea as the 3rd arg", async () => {
    mockDiscardIdea.mockReturnValue({ ok: true });
    await discardIdeaAction("idea-x", "saturado · muy complejo");
    expect(mockDiscardIdea).toHaveBeenCalledWith("idea-x", undefined, "saturado · muy complejo");
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

describe("restoreIdeaAction — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to restoreIdea with the slug", async () => {
    mockRestoreIdea.mockReturnValue({ ok: true, restoredTo: "recommended" });
    await restoreIdeaAction("idea-x");
    expect(mockRestoreIdea).toHaveBeenCalledWith("idea-x");
  });

  it("revalidates the board path on success", async () => {
    mockRestoreIdea.mockReturnValue({ ok: true, restoredTo: "discovered" });
    await restoreIdeaAction("idea-x");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/board");
  });

  it("returns the RestoreResult unchanged", async () => {
    mockRestoreIdea.mockReturnValue({ ok: true, restoredTo: "in-pipeline" });
    const result = await restoreIdeaAction("idea-x");
    expect(result).toEqual({ ok: true, restoredTo: "in-pipeline" });
  });

  it("does NOT revalidate on failure", async () => {
    mockRestoreIdea.mockReturnValue({ ok: false, reason: "not-found" });
    await restoreIdeaAction("missing");
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});

describe("toggleFavoriteAction — REQ-02-012", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to setFavorite with the slug and desired state (mark)", async () => {
    mockSetFavorite.mockReturnValue({ ok: true, favorite: true });
    await toggleFavoriteAction("idea-x", true);
    expect(mockSetFavorite).toHaveBeenCalledWith("idea-x", true);
  });

  it("delegates to setFavorite with favorite=false (unmark)", async () => {
    mockSetFavorite.mockReturnValue({ ok: true, favorite: false });
    await toggleFavoriteAction("idea-x", false);
    expect(mockSetFavorite).toHaveBeenCalledWith("idea-x", false);
  });

  it("revalidates the board path on success", async () => {
    mockSetFavorite.mockReturnValue({ ok: true, favorite: true });
    await toggleFavoriteAction("idea-x", true);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/board");
  });

  it("returns the FavoriteResult unchanged and does NOT revalidate on failure", async () => {
    mockSetFavorite.mockReturnValue({ ok: false, reason: "not-found" });
    const result = await toggleFavoriteAction("missing", true);
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
