"use client";
import { useState } from "react";
import { Button } from "@/components/core/Button/Button";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { FilterChip } from "@/components/core/Chip/FilterChip";
import { EmptyState } from "@/components/core/EmptyState/EmptyState";
import { Notice } from "@/components/core/Notice/Notice";
import { StateTile } from "@/components/core/StateTile/StateTile";
import { type BacklogAreaKey, backlogAreaKey, countByArea } from "@/lib/backlog/areas";
import type {
  BacklogItem,
  BacklogReadResult,
  BacklogSeverity,
  BacklogStatus,
} from "@/lib/backlog/backlog";
import { t } from "@/lib/copy/copy";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import { AreaBar } from "../AreaBar/AreaBar";
import { BacklogDialog } from "./BacklogDialog";
import { BacklogGroups, BacklogList } from "./BacklogGroups";
import styles from "./BacklogPanel.module.css";
import { PRIORITIES, PRIORITY_TONE, priorityLabel } from "./backlogPresentation";
import { HowToCard } from "./HowToCard";

const HINTS = { p0: "tileUrgentHint", p1: "tileImportantHint", p2: "tileSomedayHint" } as const;
/** Composes tab-local backlog filters, paged groups, history and the URL-addressed detail. */
export function BacklogPanel({
  result,
}: {
  readonly result: BacklogReadResult;
}): React.JSX.Element {
  const [priority, setPriority] = useState<BacklogSeverity | null>(null);
  const [area, setArea] = useState<BacklogAreaKey | null>(null);
  const [type, setType] = useState<"bug" | "change" | null>(null);
  const [discarded, setDiscarded] = useState<readonly string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const items = result.items.map((item) =>
    discarded.includes(item.id) ? { ...item, status: "discarded" as const } : item,
  );
  const actionable = items.filter((x) => x.status === "open" || x.status === "doing");
  const filtered = items.filter(
    (x) =>
      (!priority || x.severity === priority) &&
      (!area || backlogAreaKey(x.area) === area) &&
      (!type || x.type === type),
  );
  const isHistoryStatus = (status: BacklogStatus): boolean =>
    status === "done" || status === "discarded";
  const history = filtered.filter((x) => isHistoryStatus(x.status));
  const areas = countByArea(actionable);
  const [selectedId] = useUrlState("backlogItem", "");
  const [tab] = useUrlState("proposalsTab", "backlog");
  const selected = tab === "backlog" ? items.find((x) => x.id === selectedId) : undefined;
  function select(item: BacklogItem | null): void {
    setConfirming(false);
    updateNavigation({ proposalsTab: "backlog", backlogItem: item?.id ?? null });
  }
  return (
    <section
      data-testid="backlog-panel"
      aria-label={t("propuestas.summary.backlog.title")}
      className={styles.panel}
    >
      {result.errors.length > 0 && (
        <Notice kind="error" icon="alert">
          <strong>{t("propuestas.backlog.errors.title", { count: result.errors.length })}</strong>
          <ul>
            {result.errors.map((e) => (
              <li key={e.file}>
                <code>{e.file}</code> ({e.reason})
              </li>
            ))}
          </ul>
          <p>{t("propuestas.backlog.errors.note")}</p>
        </Notice>
      )}
      {selectedId && tab === "backlog" && !selected && (
        <Notice icon="alert">{t("propuestas.backlog.unknownItem", { id: selectedId })}</Notice>
      )}
      <fieldset
        aria-label={t("propuestas.backlog.priorityAria")}
        className={`state-strip ${styles.strip}`}
      >
        {PRIORITIES.map((p) => (
          <StateTile
            key={p}
            label={priorityLabel(p)}
            count={items.filter((x) => x.status === "open" && x.severity === p).length}
            hint={t(`propuestas.backlog.${HINTS[p]}`)}
            tone={PRIORITY_TONE[p]}
            pressed={priority === p}
            onClick={() => setPriority(priority === p ? null : p)}
          />
        ))}
      </fieldset>
      <div className={styles.columns}>
        <Card tone="blue">
          <CardHeader title={t("propuestas.backlog.byArea.title")} icon="layers" />
          <p className={styles.intro}>{t("propuestas.backlog.byArea.intro")}</p>
          <fieldset className="area-bars" aria-label={t("propuestas.backlog.byArea.aria")}>
            {areas.map((a) => (
              <AreaBar
                key={a.key}
                area={a.key}
                count={a.count}
                max={areas[0]?.count ?? 0}
                pressed={area === a.key}
                onClick={() => setArea(area === a.key ? null : a.key)}
              />
            ))}
          </fieldset>
        </Card>
        <HowToCard count={actionable.length} firstId={actionable[0]?.id} />
      </div>
      <div className={styles.toolbar}>
        <fieldset aria-label={t("propuestas.backlog.typeAria")} className={styles.chips}>
          {([null, "bug", "change"] as const).map((value) => (
            <FilterChip
              key={value ?? "all"}
              pressed={type === value}
              onClick={() => setType(value)}
            >
              {t(
                value === null
                  ? "propuestas.backlog.typeAll"
                  : value === "bug"
                    ? "propuestas.backlog.typeBugs"
                    : "propuestas.backlog.typeChanges",
              )}{" "}
              · {actionable.filter((x) => value === null || x.type === value).length}
            </FilterChip>
          ))}
        </fieldset>
        <span>
          {t("propuestas.backlog.itemCount", {
            count: filtered.filter((x) => x.status === "open" || x.status === "doing").length,
          })}
        </span>
        {(priority || area || type) && (
          <Button
            variant="ghost"
            onClick={() => {
              setPriority(null);
              setArea(null);
              setType(null);
            }}
          >
            {t("propuestas.backlog.clearFilters")}
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <EmptyState icon="check">{t("propuestas.backlog.empty")}</EmptyState>
      ) : (
        <BacklogGroups items={filtered} onSelect={select} />
      )}
      {history.length > 0 && (
        <details className={styles.history}>
          <summary>
            {t("propuestas.backlog.history")} {history.length}
          </summary>
          <BacklogList items={history} pageSize={15} onSelect={select} />
        </details>
      )}
      {selected && (
        <BacklogDialog
          key={selected.id}
          item={selected}
          confirming={confirming}
          onConfirmView={setConfirming}
          onClose={() => select(null)}
          onDiscarded={() => {
            setDiscarded([...discarded, selected.id]);
            select(null);
          }}
        />
      )}
    </section>
  );
}
