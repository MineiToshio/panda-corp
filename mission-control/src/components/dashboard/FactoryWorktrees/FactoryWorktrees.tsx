import { WorktreesCard } from "@/components/modules/Worktrees/WorktreesCard";
import { getWorktreesByRepoSync, type WorktreesByRepo } from "@/lib/pendingMerge/worktreesByRepo";
/** Shared card; streaming callers supply asynchronously resolved rows. */
export function FactoryWorktrees({
  rows,
}: {
  readonly rows?: WorktreesByRepo;
} = {}): React.JSX.Element {
  return <WorktreesCard rows={rows ?? getWorktreesByRepoSync()} />;
}
