"use server";

/**
 * Server Action for discarding a backlog item (CMP-22-discard-backlog-action, FRD-22).
 *
 * Mirrors `app/projects/[slug]/_actions/discard-change.ts` (REQ-04-008): delegates to
 * the sole write (`discardBacklogItem`), revalidates `/proposals`, and never throws —
 * every error path is a typed return value.
 *
 * Rule: human-triggered only (via DiscardBacklogButton). Never called during a render pass.
 *
 * Traceability:
 *   CMP-22-discard-backlog-action → REQ-22-007
 *   AC-22-007.1 — WHEN the owner discards an open/doing backlog item, the system SHALL
 *                 rewrite `status: discarded` in the `.md` frontmatter.
 *   Depends on lib/backlog/discard-backlog.ts (discardBacklogItem)
 */

import { revalidatePath } from "next/cache";
import { type DiscardBacklogResult, discardBacklogItem } from "@/lib/backlog/discard-backlog";

/**
 * Discard a backlog item by id.
 *
 * Delegates to `discardBacklogItem` (the sole write for this artifact type), then
 * revalidates `/proposals` so Next.js re-fetches the updated backlog. On failure,
 * returns the result unchanged without revalidating.
 *
 * @param id - The item's `id` field (e.g. `"BL-0007"`).
 * @returns DiscardBacklogResult — `{ ok: true }` on success, `{ ok: false, reason }` on failure.
 */
export async function discardBacklogAction(id: string): Promise<DiscardBacklogResult> {
  const result = discardBacklogItem(id);

  if (result.ok) {
    revalidatePath("/proposals");
  }

  return result;
}
