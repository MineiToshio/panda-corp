import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { FilterChip } from "@/components/core/Chip/FilterChip";
import { SelectField } from "@/components/core/Field/Field";
import { ListRow } from "@/components/core/ListRow/ListRow";
import { t } from "@/lib/copy/copy";
import type { ConfigurationCatalogs } from "@/lib/reference/configurationCatalogs";
import type { Standard } from "@/lib/standards/standards";
import styles from "../configuration.module.css";
import { domainLabel, matches, severityLabel } from "./catalogViews";

/** Combined severity and domain facets with mandatory standards first. */
export function StandardsCatalog({
  standards,
  domains,
  query,
  search,
  severity,
  domain,
  onSeverity,
  onDomain,
  onOpen,
}: {
  standards: Standard[];
  domains: ConfigurationCatalogs["domains"];
  query: string;
  search?: React.ReactNode;
  severity: string;
  domain: string;
  onSeverity: (value: string) => void;
  onDomain: (value: string) => void;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const searched = standards.filter((standard) =>
    matches(query, standard.title, standard.id, standard.body),
  );
  const filtered = searched
    .filter(
      (standard) =>
        (severity === "all" || standard.severity === severity) &&
        (!domain || standard.domain === domain),
    )
    .sort(
      (a, b) =>
        ({ MUST: 0, SHOULD: 1, MAY: 2 })[a.severity] - { MUST: 0, SHOULD: 1, MAY: 2 }[b.severity] ||
        a.title.localeCompare(b.title, "es"),
    );
  return (
    <div className={styles.stack}>
      <div className={styles.searchToolbar}>
        {search}
        <span className={styles.muted}>
          {t("configuracion.counts.standard", { count: filtered.length })}
        </span>
      </div>
      <div className={styles.filters}>
        <fieldset className={styles.filters} aria-label={t("configuracion.standards.severityAria")}>
          {(
            [
              { value: "all", label: "all" },
              { value: "MUST", label: "must" },
              { value: "SHOULD", label: "should" },
            ] as const
          ).map((filter) => (
            <FilterChip
              key={filter.value}
              pressed={severity === filter.value}
              onClick={() => onSeverity(filter.value)}
            >
              {t(`configuracion.standards.${filter.label}`)}{" "}
              {
                searched.filter(
                  (standard) => filter.value === "all" || standard.severity === filter.value,
                ).length
              }
            </FilterChip>
          ))}
        </fieldset>
        <SelectField
          label={t("configuracion.standards.domainAria")}
          value={domain}
          onChange={onDomain}
          options={[
            { value: "", label: t("configuracion.standards.allDomains") },
            ...domains.map((entry) => ({
              value: entry.domain,
              label: `${domainLabel(entry.domain)} (${entry.count})`,
            })),
          ]}
        />
      </div>
      <Card tone="teal">
        <CardHeader
          title={t("configuracion.standards.title")}
          icon="book"
          count={filtered.length}
        />
        {filtered.map((standard) => (
          <ListRow
            key={standard.id}
            title={standard.title}
            meta={`${standard.id} · ${standard.enforcement}`}
            icon="book"
            tone={standard.severity === "MUST" ? "coral" : "amber"}
            onClick={() => onOpen(standard.id)}
            extra={
              <span className={styles.rowChips}>
                <Chip tone="slate" variant="plain">
                  {domainLabel(standard.domain)}
                </Chip>
                <Chip tone={standard.severity === "MUST" ? "coral" : "amber"}>
                  {severityLabel(standard.severity)}
                </Chip>
              </span>
            }
          />
        ))}
        {!filtered.length ? <p>{t("configuracion.standards.empty")}</p> : null}
      </Card>
    </div>
  );
}
