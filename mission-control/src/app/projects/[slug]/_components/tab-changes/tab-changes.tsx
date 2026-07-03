/**
 * TabChanges (CMP-04-tab-changes) — Cambios tab for the project workspace.
 *
 * Server Component wrapper, same shape as TabWorkOrders/TabCommands: reads nothing
 * itself (the caller already read the queue), just hands the result to the client
 * ChangesPanel that owns the grouped list + detail modal.
 *
 * Traceability:
 *   CMP-04-tab-changes → REQ-04-006
 */

import type { ChangeQueueReadResult } from "@/lib/changes/changes";
import { ChangesPanel } from "./ChangesPanel";

export interface TabChangesProps {
  /** The project's change-queue read result (from readChangeQueue). */
  result: ChangeQueueReadResult;
  /** Absolute path to the project root — threaded to the discard Server Action. */
  projectPath: string;
  /** The project's URL slug — threaded to the discard Server Action for revalidation. */
  slug: string;
}

export function TabChanges({ result, projectPath, slug }: TabChangesProps): React.JSX.Element {
  return (
    <div data-testid="tab-changes">
      <ChangesPanel result={result} projectPath={projectPath} slug={slug} />
    </div>
  );
}
