import { Card, CardHeader } from "@/components/core/Card/Card";
import { CountPill } from "@/components/core/Chip/CountPill";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Icon } from "@/components/core/Icon/Icon";
import { Markdown } from "@/components/core/Markdown/Markdown";
import { FileReadErrors } from "@/components/modules/FileReadErrors/FileReadErrors";
import { t } from "@/lib/copy/copy";
import { formatSignalAge } from "@/lib/fragua/signal-age";
import { navigationHref } from "@/lib/navigation/urls";
import type { OverlayFreshnessState } from "@/lib/overlay-freshness/overlay-freshness";
import type { SnapshotGap } from "@/lib/snapshot/gap";
import type { SnapshotInfo } from "@/lib/snapshot/snapshot";
import type { WorkspaceProject } from "../../_panels/workspaceProject";
import { FraguaScene } from "../Fragua/FraguaScene";
import { ProgressList } from "../ProgressList/ProgressList";
import { progressItems } from "../ProgressList/progressItems";
import { SnapshotPanel } from "../snapshot-panel/snapshot-panel";
import { VersionFreshness } from "../version-freshness/version-freshness";
import { DecisionsCard } from "./DecisionsCard";
import { FrdProgress } from "./FrdProgress";
import type { readSummary } from "./readSummary";
import { SourceError } from "./SourceError";
import styles from "./tab-summary.module.css";

export interface TabSummaryProps {
  readonly project: WorkspaceProject;
  readonly navigationBaseHref: string;
  readonly data: ReturnType<typeof readSummary>;
  readonly overlayFreshness: OverlayFreshnessState;
  readonly snapshot: SnapshotInfo | null;
  readonly gap?: SnapshotGap;
  readonly ownerTurn: { readonly count: number | null; readonly content: React.ReactNode };
}

/** Resumen composition. All state comes from shared readers; commands are copy-only. */
export function TabSummary({
  project,
  navigationBaseHref,
  data,
  overlayFreshness,
  snapshot,
  gap,
  ownerTurn,
}: TabSummaryProps): React.JSX.Element {
  const { activityLog, decisions, orders, changes, timeline } = data;
  const progressError = orders.error || changes.error || timeline.error;
  const frdError = project.frdError || orders.error;
  const progressSource = failedProgressSource(data);
  const issues = sourceIssues(data);
  const occurrences = new Map<string, number>();
  const logEntries = activityLog.entries
    .map((entry) => {
      const occurrence = (occurrences.get(entry) ?? 0) + 1;
      occurrences.set(entry, occurrence);
      return { id: `${entry}:${occurrence}`, entry };
    })
    .reverse();
  return (
    <section
      data-testid="tab-summary"
      aria-label={t("common.workspaceTabs.resumen")}
      className={styles.root}
    >
      <VersionFreshness state={overlayFreshness} projectName={project.name} />
      {orders.error ? (
        <SourceError source={orders.error} />
      ) : (
        <FraguaScene
          project={{ slug: project.slug, name: project.name, path: project.projectPath }}
          openChanges={project.counts.openChanges}
          ownerPending={ownerTurn.count}
          lastActivityAt={project.lastMove}
          frds={project.frds}
        />
      )}
      {project.nextStep.command ? (
        <div className={styles.next}>
          <p>
            <strong>{t("workspace.resumen.nextStep.label")}</strong> {project.nextStep.sentence}
          </p>
          <CmdRow
            variant="box"
            command={project.nextStep.command}
            copyLabel={t("common.copy.command", { command: project.nextStep.command })}
          />
        </div>
      ) : null}
      <SnapshotPanel
        slug={project.folder}
        projectName={project.name}
        snapshot={snapshot}
        gap={gap}
        noSignalAgo={
          project.build.kind === "no-signal" ? formatSignalAge(project.build.ageMinutes) : undefined
        }
      />
      <div className={`sum-grid ${styles.columns}`}>
        <div className={styles.column}>
          <FrdProgress
            frds={project.frds}
            orders={orders.value}
            navigationBaseHref={navigationBaseHref}
            issues={issues.orders}
            error={
              frdError ? (
                <SourceError source={`${t("workspace.resumen.frdProgress.title")} (docs/frds)`} />
              ) : undefined
            }
          />
          <DecisionsCard
            decisions={decisions.value}
            nowIso={project.nowIso}
            projectName={project.name}
            projectHref={navigationHref(navigationBaseHref, { tab: "summary" })}
            error={
              decisions.error ? (
                <SourceError
                  source={`${t("workspace.resumen.decisions.title")} (.pandacorp/inbox/decisions.md)`}
                />
              ) : undefined
            }
          />
        </div>
        <div className={`sum-act ${styles.column} ${styles.action}`}>
          <Card tone="amber">
            <CardHeader
              title={t("workspace.resumen.turn.title")}
              icon="target"
              count={ownerTurn.count ?? undefined}
            />
            {ownerTurn.content}
          </Card>
          <ProgressList
            items={
              timeline.value
                ? progressItems(timeline.value, changes.value, navigationBaseHref)
                : progressItems(
                    { frds: [], source: "empty", hasDurations: false, buildStartMs: null },
                    changes.value,
                    navigationBaseHref,
                  )
            }
            issues={issues.progress}
            error={
              progressError ? (
                <SourceError
                  source={`${t("workspace.resumen.progress.title")} (${progressSource})`}
                />
              ) : undefined
            }
          />
        </div>
      </div>
      {activityLog.entries.length ? (
        <details className={styles.log} data-tone="slate">
          <summary>
            <Icon name="activity" size="sm" />
            {t("workspace.resumen.engineLog.title")}
            <CountPill count={activityLog.entries.length} />
          </summary>
          <p className={styles.meta}>{t("workspace.resumen.engineLog.hint")}</p>
          <ul>
            {logEntries.map(({ id, entry }) => (
              <li key={id}>
                <Markdown>{entry}</Markdown>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function failedProgressSource(data: ReturnType<typeof readSummary>): string {
  if (data.changes.error) return ".pandacorp/inbox/changes";
  return data.timeline.error ? ".pandacorp/track.jsonl" : "docs/frds";
}
function sourceIssues(data: ReturnType<typeof readSummary>) {
  const orders = data.orders.fileErrors ?? [];
  const progress = [...orders, ...(data.changes.fileErrors ?? [])];
  return {
    orders: orders.length ? <FileReadErrors errors={orders} /> : undefined,
    progress: progress.length ? (
      <FileReadErrors heading={t("workspace.resumen.progress.title")} errors={progress} />
    ) : undefined,
  };
}
