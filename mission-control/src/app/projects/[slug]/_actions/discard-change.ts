"use server";

/**
 * Server Action for discarding a change-queue item (CMP-04-discard-change-action, FRD-04).
 *
 * Mirrors `app/board/actions/actions.ts` (the idea discard/restore action, ADR-0002):
 * delegates to the sole write (`discardChange`), revalidates the routes that can render
 * the project workspace, and never throws — every error path is a typed return value.
 *
 * Rule: human-triggered only (via DiscardChangeButton). Never called during a render pass.
 *
 * Traceability:
 *   CMP-04-discard-change-action → REQ-04-008
 *   AC-04-008.1 — WHEN the owner discards a ready/draft change, the system SHALL rewrite
 *                 `status: discarded` in the `.md` frontmatter.
 *   Depends on lib/changes/discard-change.ts (discardChange)
 */

import { revalidatePath } from "next/cache";
import { type DiscardChangeResult, discardChange } from "@/lib/changes/discard-change";

/**
 * Discard a change-queue item by id.
 *
 * Delegates to `discardChange` (the sole write for this artifact type), then revalidates
 * both routes that can render the project workspace — the standalone `/projects/[slug]`
 * deep-link and the Portfolio's embedded workspace pane — so Next.js re-fetches the
 * updated queue. On failure, returns the result unchanged without revalidating.
 *
 * @param projectPath - Absolute path to the project root.
 * @param id          - The change's slug (filename without `.md`).
 * @param slug        - The project's URL slug — used to revalidate `/projects/<slug>`.
 * @returns DiscardChangeResult — `{ ok: true }` on success, `{ ok: false, reason }` on failure.
 */
export async function discardChangeAction(
  projectPath: string,
  id: string,
  slug: string,
): Promise<DiscardChangeResult> {
  const result = discardChange(projectPath, id);

  if (result.ok) {
    revalidatePath(`/projects/${slug}`);
    revalidatePath("/portfolio");
  }

  return result;
}
