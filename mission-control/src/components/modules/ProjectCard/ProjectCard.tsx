import Link from "next/link";
import { Avatar } from "@/components/core/Avatar/Avatar";
import { Chip } from "@/components/core/Chip/Chip";
import { phasePresentation } from "@/components/core/Chip/vocabulary";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Notice } from "@/components/core/Notice/Notice";
import { PhaseStepper } from "@/components/core/PhaseStepper/PhaseStepper";
import { Ring } from "@/components/core/Ring/Ring";
import { FreshnessBadge } from "@/components/modules/FreshnessBadge/FreshnessBadge";
import { t, tRich } from "@/lib/copy/copy";
import { formatAgo } from "@/lib/portfolio/formatAgo";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";
import styles from "./ProjectCard.module.css";

export function ProjectCard({
  project,
  compact = false,
}: {
  readonly project: ProjectOverviewItem;
  readonly compact?: boolean;
}): React.JSX.Element {
  const { tone, labelKey } = phasePresentation(project.phase);
  const { ordersVerified: done, ordersTotal: total, frds, docs } = project.counts;
  const stageLabel =
    project.stageIndex > 0
      ? t("inicio.projectCard.stage", { index: project.stageIndex, total: 6 })
      : t("common.phases.none");
  const href = `/portfolio/${encodeURIComponent(project.id)}/summary`;
  const heading = <h3>{project.name}</h3>;
  const header = (
    <div className={styles.head}>
      <Avatar name={project.name} tone={tone} />
      <div className={styles.identity}>
        {project.pathMissing ? (
          <Link href={href} className={styles.titleLink}>
            {heading}
          </Link>
        ) : (
          heading
        )}
        <Chip tone={tone} icon="dot">
          {t(labelKey)}
        </Chip>
      </div>
      {!project.pathMissing ? <ProjectProgress project={project} /> : null}
    </div>
  );
  const className = `proj-card ${styles.card}${project.pathMissing ? ` is-missing ${styles.missing}` : ""}${compact ? ` ${styles.compact}` : ""}`;
  if (project.pathMissing)
    return (
      <article className={className} data-tone={tone}>
        {header}
        <PhaseStepper phase={project.phase} compact />
        <p className={styles.age}>{stageLabel}</p>
        <Notice icon="alert" tone="coral">
          <strong>{t("inicio.pathMissing.title")}</strong>
          <p>
            {tRich(
              project.repo ? "inicio.pathMissing.bodyWithRepo" : "inicio.pathMissing.bodyNoRepo",
              { path: project.path },
            )}
          </p>
          {project.repo ? (
            <CmdRow
              variant="box"
              tone="coral"
              command={`git clone ${project.repo} ${project.path}`}
            />
          ) : null}
          <CmdRow variant="box" command="/pandacorp:sync-portfolio" />
        </Notice>
      </article>
    );
  return (
    <Link href={href} className={className} data-tone={tone}>
      {header}
      <PhaseStepper phase={project.phase} compact />
      <p className={styles.age}>
        {stageLabel}
        {t("inicio.projectCard.lastChange", {
          ago: formatAgo(project.lastCommit.at, new Date(project.nowIso)),
        })}
      </p>
      <div className={`facts ${styles.facts}`}>
        {done !== null && total !== null ? (
          <span>{tRich("inicio.projectCard.factsOrders", { done, total })}</span>
        ) : null}
        {frds !== null ? (
          <span>{tRich("inicio.projectCard.factsFrds", { count: frds })}</span>
        ) : null}
        {docs !== null ? (
          <span>{tRich("inicio.projectCard.factsDocs", { count: docs })}</span>
        ) : null}
        <FreshnessBadge signal={project.build} nowIso={project.nowIso} />
      </div>
      <p className={styles.next}>
        {tRich("inicio.projectCard.next", { command: project.nextCommand })}
      </p>
    </Link>
  );
}

function ProjectProgress({
  project,
}: {
  readonly project: ProjectOverviewItem;
}): React.JSX.Element | null {
  const { ordersVerified: done, ordersTotal: total } = project.counts;
  if (total === 0)
    return (
      <span title={t("inicio.projectCard.noOrdersTip")}>
        <Chip tone="slate" variant="plain">
          {t("inicio.projectCard.noOrders")}
        </Chip>
      </span>
    );
  if (done === null || total === null) return null;
  return (
    <Ring
      percent={(done / total) * 100}
      tone={phasePresentation(project.phase).tone}
      tip={t("inicio.projectCard.ringTip", { done, total })}
    />
  );
}
