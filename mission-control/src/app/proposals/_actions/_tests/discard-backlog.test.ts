import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { discardBacklogItem } from "@/lib/backlog/discard-backlog";
import { discardBacklogAction } from "../discard-backlog";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/backlog/discard-backlog", () => ({ discardBacklogItem: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
describe("bounded backlog action AC-22-007.1", () => {
  it("rejects malformed public input without a write", async () => {
    for (const id of [null, 4, "../BL-1", "BL-one", ""])
      expect((await discardBacklogAction(id)).ok).toBe(false);
    for (const reason of [4, {}, "x".repeat(501)])
      expect((await discardBacklogAction("BL-1", reason)).ok).toBe(false);
    expect(discardBacklogItem).not.toHaveBeenCalled();
  });
  it("trims the reason and revalidates only a successful write", async () => {
    vi.mocked(discardBacklogItem)
      .mockReturnValueOnce({ ok: true })
      .mockReturnValueOnce({ ok: false, reason: "not-discardable" });
    expect(await discardBacklogAction("BL-1", " duplicate ")).toEqual({ ok: true });
    expect(discardBacklogItem).toHaveBeenCalledWith("BL-1", "duplicate");
    expect(revalidatePath).toHaveBeenCalledWith("/proposals");
    await discardBacklogAction("BL-1");
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });
  it("returns a typed failure for unexpected write errors", async () => {
    vi.mocked(discardBacklogItem).mockImplementation(() => {
      throw new Error("disk failure");
    });
    expect(await discardBacklogAction("BL-1")).toEqual({ ok: false, reason: "parse-error" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
