import { useState } from "react";
import { Chip } from "@/components/core/Chip/Chip";
import { FilterChip } from "@/components/core/Chip/FilterChip";
import { ListRow } from "@/components/core/ListRow/ListRow";
import { MoreBar, pagedReveal } from "@/components/core/MoreBar/MoreBar";
import { t } from "@/lib/copy/copy";
import type { DecisionRule } from "@/lib/registry/registry";
import styles from "../configuration.module.css";
import { matches } from "./catalogViews";

/** URL-selected inline rule accordion with bounded progressive reveal. */
export function RulesCatalog({
  rules,
  query,
  approval,
  selected,
  onApproval,
  onOpen,
}: {
  rules: DecisionRule[];
  query: string;
  approval: string;
  selected: string;
  onApproval: (value: string) => void;
  onOpen: (value: string) => void;
}): React.JSX.Element {
  const [pressed, setPressed] = useState(0);
  const searched = rules.filter((rule) =>
    matches(query, rule.id, rule.patron, rule.default, rule.nota),
  );
  const filtered = searched.filter(
    (rule) =>
      approval === "all" || (approval === "human" ? rule.requiereHumano : !rule.requiereHumano),
  );
  const reveal = pagedReveal(filtered.length, pressed, 30, 30);
  function handleApproval(value: string): void {
    setPressed(0);
    onApproval(value);
  }
  const selectedIndex = filtered.findIndex((rule) => rule.id === selected);
  const visible = Math.max(reveal.visible, selectedIndex + 1);
  const remaining = filtered.length - visible;
  return (
    <div className={styles.stack}>
      <fieldset className={styles.filters} aria-label={t("configuracion.rules.approvalAria")}>
        {(["all", "auto", "human"] as const).map((filter) => (
          <FilterChip
            key={filter}
            pressed={approval === filter}
            onClick={() => handleApproval(filter)}
          >
            {t(`configuracion.rules.${filter}`)}{" "}
            {
              searched.filter(
                (rule) =>
                  filter === "all" ||
                  (filter === "human" ? rule.requiereHumano : !rule.requiereHumano),
              ).length
            }
          </FilterChip>
        ))}
      </fieldset>
      <p>{t("configuracion.counts.rule", { count: filtered.length })}</p>
      <div className={styles.list}>
        {filtered.slice(0, visible).map((rule) => (
          <div className="rule-row" key={rule.id}>
            <button
              type="button"
              className={styles.ruleButton}
              aria-expanded={selected === rule.id}
              aria-controls={`rule-${rule.id}`}
              onClick={() => onOpen(selected === rule.id ? "" : rule.id)}
            >
              <ListRow
                title={`${rule.id} · ${rule.patron}`}
                meta={rule.default}
                extra={
                  <Chip tone={rule.requiereHumano ? "amber" : "green"}>
                    {t(
                      rule.requiereHumano
                        ? "configuracion.rules.chipHuman"
                        : "configuracion.rules.chipAuto",
                    )}
                  </Chip>
                }
              />
            </button>
            {selected === rule.id ? (
              <section
                id={`rule-${rule.id}`}
                data-testid="rule-detail"
                aria-label={rule.id}
                className={styles.ruleDetail}
              >
                <p>{rule.default}</p>
                {rule.nota ? <p>{rule.nota}</p> : null}
              </section>
            ) : null}
          </div>
        ))}
      </div>
      {remaining ? (
        <MoreBar
          label={t("propuestas.showMore", { count: Math.min(30, remaining), remaining })}
          onClick={() => setPressed(Math.ceil((visible - 30) / 30) + 1)}
        />
      ) : null}
      {!filtered.length ? <p>{t("configuracion.rules.empty")}</p> : null}
    </div>
  );
}
