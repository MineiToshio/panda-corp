import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Icon } from "@/components/core/Icon/Icon";
import { Notice } from "@/components/core/Notice/Notice";
import { t, tRich } from "@/lib/copy/copy";
import type { SnapshotGap } from "@/lib/snapshot/gap";
import type { SnapshotInfo } from "@/lib/snapshot/snapshot";
import styles from "./snapshot-panel.module.css";

/** Snapshot display; the caller owns build visibility and the shared build-signal verdict. */
export interface SnapshotPanelProps {
  readonly slug: string;
  readonly snapshot: SnapshotInfo | null;
  readonly projectName?: string;
  readonly gap?: SnapshotGap;
  readonly noSignalAgo?: string;
}

const key = "workspace.resumen.snapshot";
function hasRunningClaim(snapshot: SnapshotInfo): boolean {
  return snapshot.buildingNow !== undefined || snapshot.noSignal === true;
}

function buildingOrder(order: string | undefined): string {
  return order && order !== "building now" ? order : t(`${key}.buildingFallback`);
}

/** Last gated commit, separate from live construction; never executes the displayed command. */
export function SnapshotPanel({
  slug,
  snapshot,
  projectName,
  gap,
  noSignalAgo,
}: SnapshotPanelProps): React.JSX.Element | null {
  if (snapshot === null) return null;
  const probe = gap?.status === "ok" ? gap : undefined;
  const stale = probe?.stale === true;
  const safe = snapshot.safeToTest && !stale;
  const verdict = stale ? "behindChip" : safe ? "safeChip" : "unsafeChip";
  const verified = probe?.verified;
  return (
    <div id="snapshot-panel" data-testid="snapshot-panel" className={styles.panel}>
      <Card tone="green">
        <CardHeader
          title={t(`${key}.title`)}
          icon="check"
          action={
            <Chip tone={safe ? "green" : "amber"} icon={safe ? "check" : "alert"}>
              {t(`${key}.${verdict}`)}
            </Chip>
          }
        />
        <p className={`card-intro ${styles.intro}`}>{t(`${key}.intro`)}</p>
        <div className={`snap-sha ${styles.sha}`} data-testid="snapshot-panel-green-section">
          <code data-testid="snapshot-panel-sha" className={styles.code}>
            {snapshot.sha.slice(0, 8)}
          </code>
          <span>
            {verified
              ? tRich(`${key}.verifiedFrd`, { id: verified.wo, frd: verified.frd })
              : t(`${key}.passedGates`)}
          </span>
        </div>
        {noSignalAgo !== undefined ? (
          <p
            className={`snap-now ${styles.now}`}
            data-tone="coral"
            data-testid="snapshot-panel-no-signal"
          >
            <Icon name="alert" size="sm" />
            <span>{t(`${key}.noSignal`, { ago: noSignalAgo })}</span>
          </p>
        ) : hasRunningClaim(snapshot) ? (
          <p
            className={`snap-now ${styles.now}`}
            data-tone="blue"
            data-testid="snapshot-panel-building-now"
          >
            <Icon name="loader" size="sm" />
            <span>
              {tRich(`${key}.buildingNow`, {
                order: buildingOrder(snapshot.buildingNow),
              })}
            </span>
          </p>
        ) : null}
        {stale && probe ? (
          <Notice icon="alert" tone="amber">
            <b>{t(`${key}.behindTitle`)}</b>
            <p>
              {t(`${key}.behindBody`, {
                commits: t(`${key}.commits`, { count: probe.commitsBehind }),
                hours: t(`${key}.hours`, { count: probe.hoursBehind }),
              })}
            </p>
          </Notice>
        ) : null}
        <div className={styles.command}>
          <span className={styles.intro}>
            {t(`${key}.testIn`, { project: projectName ?? slug })}
          </span>
          <CmdRow
            variant="box"
            command={snapshot.worktreeCommand}
            copyLabel={`Copiar ${snapshot.worktreeCommand}`}
          />
        </div>
      </Card>
    </div>
  );
}
