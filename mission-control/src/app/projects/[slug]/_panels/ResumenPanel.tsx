import { readActivityLog, readDecisions } from "@/lib/docs/activity";
import { getOverlayFreshness } from "@/lib/overlay-freshness/overlay-freshness";
import { readPending } from "@/lib/pendingMerge/pendingMerge";
import { buildSnapshot } from "@/lib/snapshot/snapshot";
import { TabSummary } from "../_components/tab-summary/tab-summary";
import type { PanelProps } from "./types";

export default function ResumenPanel({ project }: PanelProps): React.JSX.Element {
  const decisions = readDecisions(project.projectPath);
  return (
    <TabSummary
      summary={project.summary}
      keyPoints={[]}
      activityLog={readActivityLog(project.projectPath)}
      decisions={decisions}
      pendingDecisions={
        project.pendingDecisions ?? decisions.filter((decision) => !decision.resolved).length
      }
      slug={project.slug}
      snapshot={buildSnapshot(project.folder, project.status, Date.parse(project.nowIso))}
      status={project.status}
      deployTarget={project.status.deployTarget}
      deployUrl={project.status.deployUrl}
      overlayFreshness={getOverlayFreshness(project.status.overlayVersion)}
      pendingMerge={readPending(project.projectPath)}
    />
  );
}
