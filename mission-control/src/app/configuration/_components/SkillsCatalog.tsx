import { Chip } from "@/components/core/Chip/Chip";
import { FilterChip } from "@/components/core/Chip/FilterChip";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import { t } from "@/lib/copy/copy";
import type { SkillRef } from "@/lib/reference/reference";
import styles from "../configuration.module.css";
import { matches } from "./catalogViews";

/** Search and owner/internal facets, preserving undeclared scopes. */
export function SkillsCatalog({
  skills,
  query,
  type,
  onType,
  onOpen,
}: {
  skills: SkillRef[];
  query: string;
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
      <p className={styles.muted}>{t("configuracion.counts.skill", { count: filtered.length })}</p>
      {(["project", "factory", "unknown"] as const).map((scope) => {
        const group = filtered.filter((skill) => skill.runsIn === scope);
        return group.length ? (
          <section key={scope}>
            <SectionHead
              label={t(`configuracion.skills.scopes.${scope}.label`)}
              note={t(`configuracion.skills.scopes.${scope}.hint`)}
              count={group.length}
              tone="violet"
            />
            <ul className={styles.list}>
              {group.map((skill) => (
                <li key={skill.slug} className={`lrow cfg-row ${styles.skillRow}`}>
                  <button
                    type="button"
                    className={styles.description}
                    onClick={() => onOpen(skill.slug)}
                  >
                    <strong className={styles.mono}>/pandacorp:{skill.slug}</strong>
                    <small>{skill.description}</small>
                  </button>
                  {skill.internal ? (
                    <Chip tone="slate" variant="plain">
                      {t("configuracion.skills.internalChip")}
                    </Chip>
                  ) : null}
                  <CopyButton
                    value={`/pandacorp:${skill.slug}`}
                    accessibleLabel={t("common.copy.command", {
                      command: `/pandacorp:${skill.slug}`,
                    })}
                    label={t("configuracion.skills.copy")}
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null;
      })}
      {!filtered.length ? <p>{t("configuracion.skills.empty")}</p> : null}
    </div>
  );
}
