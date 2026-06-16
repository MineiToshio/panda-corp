"use server";

/**
 * WO-02-009 — Board Server Actions (CMP-02-discard-action).
 *
 * This file is the ONLY caller of `lib/discard.ts#discardIdea`.
 * It is the single mutation surface in the entire app (architecture §1/§7).
 *
 * Rule: human-triggered only (via DiscardButton client component).
 * Never called during a render pass.
 *
 * Traceability:
 *   CMP-02-discard-action → REQ-02-007
 *   AC-02-007.1 — WHEN the owner presses "Discard idea", the system SHALL rewrite
 *                 `status: discarded` in the `.md` frontmatter.
 *   Depends on WO-02-004 (discardIdea, lib/discard.ts)
 */

import { revalidatePath } from "next/cache";
import { type DiscardResult, discardIdea } from "@/lib/discard";

/**
 * Discard an idea by slug.
 *
 * Delegates to `discardIdea` (the sole write in the codebase), then
 * revalidates the board route so Next.js re-fetches the updated idea list.
 *
 * On failure, returns the DiscardResult unchanged without revalidating.
 * Never throws — all error paths are expressed as typed return values.
 *
 * @param slug - The idea slug (filename without `.md`).
 * @returns DiscardResult — `{ ok: true }` on success, `{ ok: false, reason }` on failure.
 */
export async function discardIdeaAction(slug: string): Promise<DiscardResult> {
  const result = discardIdea(slug);

  if (result.ok) {
    revalidatePath("/board");
  }

  return result;
}
