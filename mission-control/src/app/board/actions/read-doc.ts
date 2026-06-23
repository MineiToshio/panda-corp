"use server";

/**
 * Board read action (CMP-02-card-detail / IF-04-docs) — the lazy doc reader.
 *
 * Separate from `actions/actions.ts` ON PURPOSE: that file is the single MUTATION
 * surface (discardIdea, the app's only write). This is a READ-only action used by
 * the card-detail Documentos tab to fetch a scoped project doc's body on demand,
 * so the board stays light (only the doc STRUCTURE is shipped at render).
 *
 * Security: `readDoc` validates relPath against the project's discovered doc set
 * (traversal-safe — rejects .pandacorp, work-orders, absolute paths, traversal).
 */

import { resolveProjectPath } from "@/lib/config/config";
import { readDoc } from "@/lib/docs/tree";

/** Read a scoped project doc on demand for the board card-detail. Read-only;
 *  readDoc validates relPath against the project's discovered doc set (traversal-safe). */
export async function readBoardDoc(project: string, relPath: string): Promise<string | null> {
  if (!project || !relPath) return null;
  return readDoc(resolveProjectPath(project), relPath);
}
