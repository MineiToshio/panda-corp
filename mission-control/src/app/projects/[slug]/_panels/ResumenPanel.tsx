import { AskRow } from "@/components/dashboard/TuTurno/AskRow";
import { t } from "@/lib/copy/copy";
import { ownerTurnItems } from "@/lib/inicio/turn";
import { getOverlayFreshness } from "@/lib/overlay-freshness/overlay-freshness";
import { readSnapshotGap } from "@/lib/snapshot/gap";
import { buildSnapshot } from "@/lib/snapshot/snapshot";
import { readSummary } from "../_components/tab-summary/readSummary";
import { SourceError } from "../_components/tab-summary/SourceError";
import { TabSummary } from "../_components/tab-summary/tab-summary";
import type { PanelProps } from "./types";

/** Mount shared scene facts and gate the green snapshot on the authoritative running claim. */
export default function ResumenPanel({ project, route }: PanelProps): React.JSX.Element {
  const turn = ownerTurnItems({ project: project.projectPath });
  const data = readSummary(project.projectPath);
  const snapshot =
    project.status.running === true
      ? buildSnapshot(project.folder, project.status, Date.parse(project.nowIso))
      : null;
  const gap = snapshot ? readSnapshotGap(project.projectPath, snapshot.sha) : undefined;
  return (
    <TabSummary
      project={project}
      navigationBaseHref={route.navigationBaseHref}
      data={data}
      snapshot={snapshot}
      gap={gap}
      overlayFreshness={getOverlayFreshness(project.status.overlayVersion)}
      ownerTurn={{
        count: turn.errors.length ? null : turn.count,
        content: (
          <>
            {turn.errors.length ? <SourceError source={t("workspace.resumen.turn.title")} /> : null}
            {turn.items.length ? (
              <ul>
                {turn.items.map((item) => (
                  <AskRow key={`${item.kind}:${item.id}`} item={item} />
                ))}
              </ul>
            ) : !turn.errors.length ? (
              <p>{t("workspace.resumen.turn.empty")}</p>
            ) : null}
          </>
        ),
      }}
    />
  );
}
