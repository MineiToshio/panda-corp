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
import { type DiscardResult, discardIdea } from "@/lib/discard/discard";
import { type RestoreResult, restoreIdea } from "@/lib/discard/restore";

/**
 * Discard an idea by slug.
 *
 * Delegates to `discardIdea` (the sole write in the codebase), then
 * revalidates the board route so Next.js re-fetches the updated idea list.
 *
 * On failure, returns the DiscardResult unchanged without revalidating.
 * Never throws — all error paths are expressed as typed return values.
 *
 * @param slug   - The idea slug (filename without `.md`).
 * @param reason - Optional. The owner's reason for discarding (free text, Spanish), written to
 *                 the `discard_reason` frontmatter so discovery can learn the rejection pattern.
 * @returns DiscardResult — `{ ok: true }` on success, `{ ok: false, reason }` on failure.
 */
export async function discardIdeaAction(slug: string, reason?: string): Promise<DiscardResult> {
  // ideasDir omitted (production default); reason threaded through as the 3rd arg.
  const result = discardIdea(slug, undefined, reason);

  if (result.ok) {
    revalidatePath("/board");
  }

  return result;
}

/**
 * Restore (un-discard) an idea by slug — "Volver a agregar".
 *
 * Delegates to `restoreIdea` (the board's inverse single write), then revalidates the
 * board route. Returns the card to its prior status and clears discard_reason. Never throws.
 *
 * @param slug - The idea slug (filename without `.md`).
 * @returns RestoreResult — `{ ok: true, restoredTo }` on success, `{ ok: false, reason }` on failure.
 */
export async function restoreIdeaAction(slug: string): Promise<RestoreResult> {
  const result = restoreIdea(slug);

  if (result.ok) {
    revalidatePath("/board");
  }

  return result;
}
