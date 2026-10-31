import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { CopyText } from "@/components/core/CopyText/CopyText";
import { ListRow } from "@/components/core/ListRow/ListRow";
import { t } from "@/lib/copy/copy";
import type { ConfigurationCatalogs } from "@/lib/reference/configurationCatalogs";
import styles from "../configuration.module.css";
import { type CatalogSection, LABELS, SECTIONS, searchCatalogs, TONES } from "./catalogViews";

export interface HubProps {
  catalogs: ConfigurationCatalogs;
  query: string;
  onOpen: (section: CatalogSection, item?: string) => void;
}
/** Summary counts and copy-only owner commands, replaced by cross-catalog search results. */
export function ConfigHub({ catalogs, query, onOpen }: HubProps): React.JSX.Element {
  if (query.trim()) {
    const hits = searchCatalogs(catalogs, query);
    return (
      <Card>
        <CardHeader title={t("configuracion.hub.results")} count={hits.length} />
        {hits.length ? (
          hits.map((hit) => (
            <ListRow
              key={`${hit.section}/${hit.id}`}
              title={hit.title}
              meta={hit.excerpt}
              onClick={() => onOpen(hit.section, hit.id)}
              extra={
                <Chip tone={TONES[hit.section]}>
                  {t(
                    `configuracion.kinds.${({ skills: "skill", agents: "agent", rules: "rule", standards: "standard" } as const)[hit.section]}`,
                  )}
                </Chip>
              }
            />
          ))
        ) : (
          <p>{t("configuracion.hub.noMatch")}</p>
        )}
      </Card>
    );
  }
  const { counts } = catalogs;
  const subtitles = {
    skills: t("configuracion.hub.skillsSub", { own: counts.owner, internal: counts.internal }),
    agents: Object.entries(counts.tiers)
      .filter(([, count]) => count)
      .map(
        ([tier, count]) =>
          `${count} ${t(`configuracion.agents.models.${tier as keyof typeof counts.tiers}.label`)}`,
      )
      .join(" · "),
    rules: t("configuracion.hub.rulesSub", { human: counts.human, auto: counts.auto }),
    standards: t("configuracion.hub.standardsSub", { must: counts.must, should: counts.should }),
  };
  return (
    <div className={styles.stack}>
      <div className={`cfg-tiles ${styles.tiles}`}>
        {SECTIONS.filter((section) => catalogs[section].ok).map((section) => (
          <button
            type="button"
            className={`cfg-tile ${styles.tile}`}
            data-tone={TONES[section]}
            key={section}
            onClick={() => onOpen(section)}
          >
            <span>{t(LABELS[section])}</span>
            <b>{counts[section]}</b>
            <small>{subtitles[section]}</small>
          </button>
        ))}
      </div>
      {catalogs.skills.ok ? (
        <Card tone="violet">
          <CardHeader title={t("configuracion.hub.commands.title")} count={counts.owner} />
          <p className={styles.muted}>{t("configuracion.hub.commands.intro")}</p>
          <div className={`cmd-grid ${styles.commands}`}>
            {catalogs.ownerCommands.map((skill) => (
              <div className={styles.command} key={skill.slug}>
                <CopyText text={`/pandacorp:${skill.slug}`} />
                <button
                  type="button"
                  className={styles.description}
                  onClick={() => onOpen("skills", skill.slug)}
                >
                  {skill.description}
                </button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
