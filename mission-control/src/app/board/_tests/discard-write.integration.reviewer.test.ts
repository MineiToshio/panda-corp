/**
 * FRD-02 — discard write path — REVIEWER integration tests (DR-015, DR-050 gate).
 *
 * Exercises WO-02-009 (discardIdeaAction) composed with the REAL WO-02-004
 * (lib/discard.ts — the single fs.write in the app), NOT a mock. The existing
 * actions.test.ts mocks discardIdea; this asserts the end-to-end write contract
 * the owner actually depends on.
 *
 * Adversarial angles the implementers did not cover together:
 *   - The "single write" invariant under real I/O: only the targeted card is
 *     rewritten; sibling cards are byte-for-byte untouched; the body and every
 *     other frontmatter field are preserved verbatim (B1' numbers, I2 objects,
 *     I3 arrays).
 *   - revalidatePath is a side effect: it must fire on success and must NOT
 *     fire on a failed discard (not-found / traversal). A spurious revalidate
 *     on failure would churn the board for nothing.
 *   - Path traversal through the action must be rejected end-to-end and write
 *     nothing.
 *
 * EARS anchor: AC-02-007.1 (rewrite status: discarded, preserve the rest — the
 * only write).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Only next/cache is mocked — discardIdea runs for real against a temp dir.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { revalidatePath } from "next/cache";
import { discardIdeaAction } from "../actions/actions";

const mockRevalidate = vi.mocked(revalidatePath);

let tmpRoot: string;
let ideasDir: string;
let prevEnv: string | undefined;

// discardIdeaAction calls discardIdea(slug) with NO ideasDir override, so it
// resolves from resolveFactoryRoot() → <factoryRoot>/factory/ideas. We point
// PANDACORP_FACTORY_ROOT at a temp factory root and create that structure.
beforeEach(() => {
  prevEnv = process.env.PANDACORP_FACTORY_ROOT;
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "frd02-discard-"));
  ideasDir = path.join(tmpRoot, "factory", "ideas");
  fs.mkdirSync(ideasDir, { recursive: true });
  process.env.PANDACORP_FACTORY_ROOT = tmpRoot;
  mockRevalidate.mockClear();
});

afterEach(() => {
  if (prevEnv === undefined) {
    process.env.PANDACORP_FACTORY_ROOT = undefined;
    delete process.env.PANDACORP_FACTORY_ROOT;
  } else {
    process.env.PANDACORP_FACTORY_ROOT = prevEnv;
  }
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function writeCard(slug: string, content: string): string {
  const p = path.join(ideasDir, `${slug}.md`);
  fs.writeFileSync(p, content, "utf-8");
  return p;
}

describe("FRD-02 integration: discardIdeaAction → real discardIdea single-write contract", () => {
  it("rewrites status: discarded preserving body + all other frontmatter verbatim", async () => {
    const original = [
      "---",
      "title: My idea",
      "status: recommended",
      "score: 87",
      "project_type: web",
      "tags:",
      "  - growth",
      "  - b2b",
      "meta:",
      "  effort: high",
      "---",
      "# Body heading",
      "",
      "Some **markdown** body with detail.",
      "",
    ].join("\n");
    const file = writeCard("alpha", original);

    const result = await discardIdeaAction("alpha");
    expect(result).toEqual({ ok: true });

    const after = matter(fs.readFileSync(file, "utf-8"));
    // The one field we are allowed to change:
    expect(after.data.status).toBe("discarded");
    // Everything else preserved verbatim (B1' number, I3 array, I2 object).
    expect(after.data.title).toBe("My idea");
    expect(after.data.score).toBe(87);
    expect(after.data.project_type).toBe("web");
    expect(after.data.tags).toEqual(["growth", "b2b"]);
    expect(after.data.meta).toEqual({ effort: "high" });
    expect(after.content.trim()).toBe("# Body heading\n\nSome **markdown** body with detail.");
  });

  it("only the targeted card is written — sibling cards are byte-for-byte untouched", async () => {
    const siblingRaw = "---\ntitle: Sibling\nstatus: discovered\n---\nKeep me intact.\n";
    const target = writeCard("target", "---\ntitle: Target\nstatus: discovered\n---\nBody.\n");
    const sibling = writeCard("sibling", siblingRaw);

    const before = fs.readFileSync(sibling, "utf-8");
    await discardIdeaAction("target");
    const afterSibling = fs.readFileSync(sibling, "utf-8");

    expect(afterSibling).toBe(before); // sibling untouched
    expect(matter(fs.readFileSync(target, "utf-8")).data.status).toBe("discarded");
  });

  it("fires revalidatePath('/board') exactly once on success", async () => {
    writeCard("beta", "---\ntitle: Beta\nstatus: discovered\n---\nx\n");
    await discardIdeaAction("beta");
    expect(mockRevalidate).toHaveBeenCalledTimes(1);
    expect(mockRevalidate).toHaveBeenCalledWith("/board");
  });

  it("does NOT revalidate when the card does not exist (no spurious board churn)", async () => {
    const result = await discardIdeaAction("does-not-exist");
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("rejects path traversal end-to-end and writes nothing", async () => {
    // A secret file outside the ideas dir that must never be touched.
    const secret = path.join(tmpRoot, "secret.md");
    fs.writeFileSync(secret, "---\ntitle: secret\nstatus: discovered\n---\nsensitive\n", "utf-8");
    const before = fs.readFileSync(secret, "utf-8");

    const result = await discardIdeaAction("../../secret");
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(mockRevalidate).not.toHaveBeenCalled();
    expect(fs.readFileSync(secret, "utf-8")).toBe(before); // untouched
  });

  it("empty slug is rejected and writes nothing", async () => {
    const result = await discardIdeaAction("");
    expect(result).toEqual({ ok: false, reason: "not-found" });
    expect(mockRevalidate).not.toHaveBeenCalled();
  });

  it("discarding an already-discarded card is idempotent (ok, body still intact)", async () => {
    const file = writeCard(
      "gamma",
      "---\ntitle: Gamma\nstatus: discarded\nscore: 5\n---\nBody stays.\n",
    );
    const result = await discardIdeaAction("gamma");
    expect(result).toEqual({ ok: true });
    const after = matter(fs.readFileSync(file, "utf-8"));
    expect(after.data.status).toBe("discarded");
    expect(after.data.score).toBe(5);
    expect(after.content.trim()).toBe("Body stays.");
  });
});
