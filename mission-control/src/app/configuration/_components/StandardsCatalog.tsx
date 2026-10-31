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
  severity,
  domain,
  onSeverity,
  onDomain,
  onOpen,
}: {
  standards: Standard[];
  domains: ConfigurationCatalogs["domains"];
  query: string;
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
        ({ MUST: 0, SHOULD: 1, MAY: 2 })[a.severity] - { MUST: 0, SHOULD: 1, MAY: 2 }[b.severity],
    );
  return (
    <Card tone="teal">
      <CardHeader title={t("configuracion.standards.title")} />
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
      {query || severity !== "all" || domain ? (
        <p className={styles.muted}>
          {t("configuracion.search.countOf", { count: filtered.length, total: standards.length })}
        </p>
      ) : null}
      {filtered.map((standard) => (
        <ListRow
          key={standard.id}
          title={standard.title}
          meta={standard.summary.join(" ")}
          onClick={() => onOpen(standard.id)}
          extra={
            <>
              <small>
                {standard.id} · {standard.enforcement}
              </small>
              <Chip tone="slate" variant="plain">
                {domainLabel(standard.domain)}
              </Chip>
              <Chip tone={standard.severity === "MUST" ? "amber" : "teal"}>
                {severityLabel(standard.severity)}
              </Chip>
            </>
          }
        />
      ))}
      {!filtered.length ? <p>{t("configuracion.standards.empty")}</p> : null}
    </Card>
  );
}
