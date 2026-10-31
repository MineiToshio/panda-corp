import { phasePresentation } from "@/components/core/Chip/vocabulary";
import { PhaseStepper } from "@/components/core/PhaseStepper/PhaseStepper";
import { ProjectSwitcher } from "@/components/modules/ProjectSwitcher/ProjectSwitcher";
import { t } from "@/lib/copy/copy";
import { type ProjectHeroProps, ProjectIdentity } from "../ProjectHero/ProjectHero";
import styles from "./ProjectHeroCompact.module.css";

export function ProjectHeroCompact({ project, headingLevel }: ProjectHeroProps): React.JSX.Element {
  const { done, total, pct } = project.progress;
  return (
    <header
      data-testid="project-hero-compact"
      className={styles.hero}
      data-tone={phasePresentation(project.phase).tone}
    >
      <ProjectIdentity project={project} headingLevel={headingLevel} size="md">
        {total === 0 ? (
          <span className="small faint">{t("workspace.hero.compact.noOrders")}</span>
        ) : done !== null && total !== null && pct !== null ? (
          <span className="small faint">
            {t("workspace.hero.compact.progress", { done, total, pct })}
          </span>
        ) : null}
      </ProjectIdentity>
      <div className={styles.step}>
        <PhaseStepper phase={project.phase} compact />
      </div>
      <ProjectSwitcher projects={project.projects} currentId={project.slug} />
    </header>
  );
}
