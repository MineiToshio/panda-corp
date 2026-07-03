/**
 * discard-change.ts (Server Action) tests — mirrors app/board/actions/_tests/actions.test.ts.
 *
 * Traceability:
 *   CMP-04-discard-change-action → REQ-04-008
 *   AC-04-008.1 — WHEN the owner discards a ready/draft change, the system SHALL rewrite
 *                 `status: discarded` in the `.md` frontmatter.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/changes/discard-change", () => ({
  discardChange: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { discardChange } from "@/lib/changes/discard-change";
import { discardChangeAction } from "../discard-change";

const mockDiscardChange = vi.mocked(discardChange);
const mockRevalidatePath = vi.mocked(revalidatePath);

describe("discardChangeAction — happy path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to discardChange with projectPath and id", async () => {
    mockDiscardChange.mockReturnValue({ ok: true });
    await discardChangeAction("/tmp/proj", "mc-export-csv", "mission-control");
    expect(mockDiscardChange).toHaveBeenCalledWith("/tmp/proj", "mc-export-csv");
  });

  it("revalidates both the project route and the portfolio on success", async () => {
    mockDiscardChange.mockReturnValue({ ok: true });
    await discardChangeAction("/tmp/proj", "mc-export-csv", "mission-control");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/projects/mission-control");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/portfolio");
  });

  it("returns { ok: true } unchanged", async () => {
    mockDiscardChange.mockReturnValue({ ok: true });
    const result = await discardChangeAction("/tmp/proj", "mc-x", "mission-control");
    expect(result).toEqual({ ok: true });
  });
});

describe("discardChangeAction — failure paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not-found unchanged and does not revalidate", async () => {
    mockDiscardChange.mockReturnValue({ ok: false, reason: "not-found" });
    const result = await discardChangeAction("/tmp/proj", "mc-missing", "mission-control");
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("returns not-discardable unchanged and does not revalidate", async () => {
    mockDiscardChange.mockReturnValue({ ok: false, reason: "not-discardable" });
    const result = await discardChangeAction("/tmp/proj", "mc-done", "mission-control");
    expect(result).toEqual({ ok: false, reason: "not-discardable" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("returns parse-error unchanged and does not revalidate", async () => {
    mockDiscardChange.mockReturnValue({ ok: false, reason: "parse-error" });
    const result = await discardChangeAction("/tmp/proj", "mc-broken", "mission-control");
    expect(result).toEqual({ ok: false, reason: "parse-error" });
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });

  it("never throws", async () => {
    mockDiscardChange.mockReturnValue({ ok: false, reason: "parse-error" });
    await expect(
      discardChangeAction("/tmp/proj", "mc-broken", "mission-control"),
    ).resolves.not.toThrow();
  });
});
