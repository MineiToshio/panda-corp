import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { FilterChip } from "@/components/core/Chip/FilterChip";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import { t } from "@/lib/copy/copy";
import type { SkillRef } from "@/lib/reference/reference";
import styles from "../configuration.module.css";
import { firstSentence, matches } from "./catalogViews";

/** Search and owner/internal facets, preserving undeclared scopes. */
export function SkillsCatalog({
  skills,
  query,
  search,
  type,
  onType,
  onOpen,
}: {
  skills: SkillRef[];
  query: string;
  search?: React.ReactNode;
  type: string;
  onType: (type: string) => void;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const searched = skills.filter((skill) =>
    matches(query, skill.slug, skill.description, skill.body),
  );
  const filters = [
    { id: "all", label: t("configuracion.skills.all"), count: searched.length },
    {
      id: "owner",
      label: t("configuracion.skills.owner"),
      count: searched.filter((skill) => !skill.internal).length,
    },
    {
      id: "internal",
      label: t("configuracion.skills.internal"),
      count: searched.filter((skill) => skill.internal).length,
    },
  ];
  const filtered = searched.filter(
    (skill) => type === "all" || (type === "internal" ? skill.internal : !skill.internal),
  );
  return (
    <div className={styles.stack}>
      <div className={styles.searchToolbar}>
        {search}
        <span className={styles.muted}>
          {t("configuracion.counts.skill", { count: filtered.length })}
        </span>
      </div>
      <fieldset aria-label={t("configuracion.skills.typeAria")} className={styles.filters}>
        {filters.map((filter) => (
          <FilterChip
            key={filter.id}
            pressed={type === filter.id}
            onClick={() => onType(filter.id)}
          >
            {filter.label} <span>{filter.count}</span>
          </FilterChip>
        ))}
      </fieldset>

      {(["project", "factory", "unknown"] as const).map((scope) => {
        const group = filtered.filter((skill) => skill.runsIn === scope);
        return group.length ? (
          <Card key={scope} tone="violet">
            <CardHeader
              title={t(`configuracion.skills.scopes.${scope}.label`)}
              count={group.length}
              icon={scope === "project" ? "folder" : scope === "factory" ? "factory" : "layers"}
            />
            <p className={styles.intro}>{t(`configuracion.skills.scopes.${scope}.hint`)}</p>
            <ul className={styles.list}>
              {group.map((skill) => (
                <li key={skill.slug} className={`lrow cfg-row ${styles.skillRow}`}>
                  <BadgeIcon icon="bolt" tone="violet" size="sm" />
                  <button
                    type="button"
                    className={styles.description}
                    onClick={() => onOpen(skill.slug)}
                  >
                    <strong className={styles.mono}>/pandacorp:{skill.slug}</strong>
                    <small>{firstSentence(skill.description)}</small>
                  </button>
                  {skill.internal ? (
                    <Chip tone="slate" variant="plain">
                      {t("configuracion.skills.internalChip")}
                    </Chip>
                  ) : null}
                  {!skill.internal ? (
                    <CopyButton
                      variant="text"
                      value={`/pandacorp:${skill.slug}`}
                      accessibleLabel={t("common.copy.command", {
                        command: `/pandacorp:${skill.slug}`,
                      })}
                      label={t("configuracion.skills.copy")}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null;
      })}
      {!filtered.length ? <p>{t("configuracion.skills.empty")}</p> : null}
    </div>
  );
}
