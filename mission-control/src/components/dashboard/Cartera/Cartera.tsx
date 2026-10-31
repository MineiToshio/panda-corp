import Link from "next/link";
import { CardHeader } from "@/components/core/Card/Card";
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
      <CardHeader
        title={t("inicio.portfolio.title")}
        icon="folder"
        action={<Link href="/portfolio">{t("inicio.portfolio.seeAll")}</Link>}
      />
      {cards.length ? (
        <div className={styles.cards}>
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
