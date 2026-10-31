import { Avatar } from "@/components/core/Avatar/Avatar";
import { Chip } from "@/components/core/Chip/Chip";
import { phasePresentation } from "@/components/core/Chip/vocabulary";
import { PhaseStepper } from "@/components/core/PhaseStepper/PhaseStepper";
import { Ring } from "@/components/core/Ring/Ring";
import { FreshnessBadge } from "@/components/modules/FreshnessBadge/FreshnessBadge";
import { ProjectSwitcher } from "@/components/modules/ProjectSwitcher/ProjectSwitcher";
import { type CopyKey, t } from "@/lib/copy/copy";
import { formatRelative } from "@/lib/copy/dates";
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
  size = "lg",
  children,
}: ProjectHeroProps & {
  readonly size?: "md" | "lg";
  readonly children?: React.ReactNode;
}): React.JSX.Element {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const { tone, labelKey } = phasePresentation(project.phase);
  const phase = (
    <Chip tone={tone} icon="dot">
      {t(labelKey)}
    </Chip>
  );
  return (
    <div className={styles.identity}>
      <Avatar name={project.name} tone={tone} size={size} />
      <div>
        {size === "lg" ? (
          <>
            <div className={styles.chips}>
              {phase}
              {children}
            </div>
            <Heading>{project.name}</Heading>
          </>
        ) : (
          <>
            <Heading>{project.name}</Heading>
            <div className={styles.chips}>
              {phase}
              {children}
            </div>
          </>
        )}
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
        <ProjectIdentity project={project} headingLevel={headingLevel}>
          <Chip tone="slate" variant="plain">
            {project.version
              ? t("workspace.hero.version", { version: project.version.replace(/^v/i, "") })
              : t("workspace.hero.noVersion")}
          </Chip>
          {project.build.kind === "idle" ? (
            <Chip tone="slate" variant="plain">
              {t("workspace.hero.noBuild")}
            </Chip>
          ) : (
            <FreshnessBadge signal={project.build} nowIso={project.nowIso} />
          )}
        </ProjectIdentity>
        <ProjectSwitcher projects={project.projects} currentId={project.slug} />
      </div>
      <ProjectSubtitle key={project.projectPath} text={project.summary} />
      <div className={styles.stats}>
        {project.overview?.orderErrors?.length ? (
          <span>
            {t("readerFailures.unreadFiles", { count: project.overview.orderErrors.length })}
          </span>
        ) : null}
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
            <b>{formatRelative(project.lastMove.slice(0, 10), project.nowIso)}</b>
            <small>{t("workspace.hero.stats.lastMove")}</small>
          </div>
        )}
      </div>
      <PhaseStepper phase={project.phase} />
    </header>
  );
}
