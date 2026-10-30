import { WorktreesCard } from "@/components/modules/Worktrees/WorktreesCard";
import { getWorktreesByRepo } from "@/lib/pendingMerge/worktreesByRepo";
export function FactoryWorktrees(): React.JSX.Element {
  return <WorktreesCard rows={getWorktreesByRepo()} />;
}
