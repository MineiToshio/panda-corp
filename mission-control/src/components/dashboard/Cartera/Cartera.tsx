import Link from "next/link";
import { Icon } from "@/components/core/Icon/Icon";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { FirstProjectCard } from "@/components/modules/ProjectCard/FirstProjectCard";
import { ProjectCard } from "@/components/modules/ProjectCard/ProjectCard";
import { t } from "@/lib/copy/copy";
import type { ProjectOverviewItem } from "@/lib/portfolio/overview";
import styles from "./Cartera.module.css";
/** Compact project cards from the portfolio's shared projection and order. */
export function Cartera({
  cards,
}: {
  readonly cards: readonly ProjectOverviewItem[];
}): React.JSX.Element {
  return (
    <section data-tone="blue">
      <SectionHead
        as="h2"
        label={t("inicio.portfolio.title")}
        icon="folder"
        tone="blue"
        rightHtml={
          <Link className="link xs" data-tone="blue" href="/portfolio">
            {t("inicio.portfolio.seeAll")} <Icon name="arrow" size="sm" />
          </Link>
        }
      />
      {cards.length ? (
        <div className={`proj-cards ${styles.cards}`}>
          {cards.map((project) => (
            <ProjectCard key={project.id} project={project} compact />
          ))}
        </div>
      ) : (
        <FirstProjectCard />
      )}
    </section>
  );
}
