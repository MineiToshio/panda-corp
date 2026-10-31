import { Avatar } from "@/components/core/Avatar/Avatar";
import { Chip } from "@/components/core/Chip/Chip";
import { phasePresentation } from "@/components/core/Chip/vocabulary";
import { PhaseStepper } from "@/components/core/PhaseStepper/PhaseStepper";
import { Ring } from "@/components/core/Ring/Ring";
import { FreshnessBadge } from "@/components/modules/FreshnessBadge/FreshnessBadge";
import { ProjectSwitcher } from "@/components/modules/ProjectSwitcher/ProjectSwitcher";
import { type CopyKey, t } from "@/lib/copy/copy";
import { formatAgo } from "@/lib/portfolio/formatAgo";
import type { WorkspaceProject } from "../../_panels/workspaceProject";
import styles from "./ProjectHero.module.css";
import { ProjectSubtitle } from "./ProjectSubtitle";

export interface ProjectHeroProps {
  project: WorkspaceProject;
  headingLevel?: 1 | 2;
}
export function ProjectIdentity({
  project,
  headingLevel = 1,
}: ProjectHeroProps): React.JSX.Element {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const { tone, labelKey } = phasePresentation(project.phase);
  return (
    <div className={styles.identity}>
      <Avatar name={project.name} initials={project.initials} tone={tone} size="lg" />
      <div>
        <Heading>{project.name}</Heading>
        <Chip tone={tone}>{t(labelKey)}</Chip>
      </div>
    </div>
  );
}
export function ProjectHero({ project, headingLevel }: ProjectHeroProps): React.JSX.Element {
  const { tone } = phasePresentation(project.phase);
  const { progress, counts } = project;
  const stats: readonly [number | null, CopyKey][] = [
    [counts.frds, "workspace.hero.stats.frds"],
    [counts.documents, "workspace.hero.stats.documents"],
    [counts.adrs, "workspace.hero.stats.adrs"],
    [counts.openChanges, "workspace.hero.stats.openChanges"],
  ];
  return (
    <header className={styles.hero} data-tone={tone} data-testid="project-hero">
      <div className={styles.top}>
        <ProjectIdentity project={project} headingLevel={headingLevel} />
        <ProjectSwitcher projects={project.projects} currentId={project.slug} />
      </div>
      <div className={styles.chips}>
        <Chip tone="slate">
          {project.version
            ? t("workspace.hero.version", { version: project.version })
            : t("workspace.hero.noVersion")}
        </Chip>
        {project.build.kind === "idle" ? (
          <Chip tone="slate">{t("workspace.hero.noBuild")}</Chip>
        ) : (
          <FreshnessBadge signal={project.build} nowIso={project.nowIso} />
        )}
      </div>
      <ProjectSubtitle key={project.projectPath} text={project.summary} />
      <div className={styles.stats}>
        {progress.pct !== null && <Ring percent={progress.pct} size="lg" tone={tone} />}
        {progress.total === 0 ? (
          <span>{t("workspace.hero.stats.noPlan")}</span>
        ) : progress.done !== null && progress.total !== null ? (
          <div className={styles.stat}>
            <b>
              {progress.done}/{progress.total}
            </b>
            <small>{t("workspace.hero.stats.ordersVerified")}</small>
          </div>
        ) : null}
        {stats.map(([value, label]) =>
          value === null ? null : (
            <div className={styles.stat} key={label}>
              <b>{value}</b>
              <small>{t(label)}</small>
            </div>
          ),
        )}
        {project.lastMove && (
          <div className={styles.stat}>
            <b>{formatAgo(project.lastMove, new Date(project.nowIso))}</b>
            <small>{t("workspace.hero.stats.lastMove")}</small>
          </div>
        )}
      </div>
      <PhaseStepper phase={project.phase} />
    </header>
  );
}
