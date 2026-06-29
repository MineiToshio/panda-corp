"use server";

/**
 * WO-02-009 — Board Server Actions (CMP-02-discard-action).
 *
 * The Server Actions for the board's bounded writes: discard/restore status (`lib/discard/`) and
 * the visual favourite flag (`lib/favorite/`, ADR-0003). This is the app's mutation surface
 * (architecture §1/§7); everything else is read-only.
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
import { type FavoriteResult, setFavorite } from "@/lib/favorite/favorite";

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

/**
 * Mark / unmark an idea as a favourite (the board's third write, ADR-0003).
 *
 * Delegates to `setFavorite` (which rewrites only the `favorite` frontmatter field of one
 * card), then revalidates the board route. Visual-only: it never touches `status` or the
 * board column — it just lets the owner highlight cards in any column (REQ-02-012). Never throws.
 *
 * @param slug     - The idea slug (filename without `.md`).
 * @param favorite - The desired state (true = mark, false = unmark).
 * @returns FavoriteResult — `{ ok: true, favorite }` on success, `{ ok: false, reason }` on failure.
 */
export async function toggleFavoriteAction(
  slug: string,
  favorite: boolean,
): Promise<FavoriteResult> {
  const result = setFavorite(slug, favorite);

  if (result.ok) {
    revalidatePath("/board");
  }

  return result;
}
