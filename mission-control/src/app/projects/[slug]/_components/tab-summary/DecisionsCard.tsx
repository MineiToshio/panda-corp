"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { DividedList, ListRow } from "@/components/core/ListRow/ListRow";
import { Modal } from "@/components/core/Modal/Modal";
import { t, tRich } from "@/lib/copy/copy";
import { formatDate, formatRelative } from "@/lib/copy/dates";
import type { DecisionPoint } from "@/lib/docs/activity";
import { isEngineLogEntry } from "@/lib/docs/decision-kind";
import styles from "./tab-summary.module.css";

function decisionMeta(decision: DecisionPoint, nowIso?: string): string {
  const age =
    decision.date && nowIso && !decision.resolved ? formatRelative(decision.date, nowIso) : null;
  return [
    decision.id,
    age,
    decision.date ? formatDate(decision.date) : null,
    decision.resolvedInFile ? t("workspace.resumen.decisions.resolvedInFile") : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Human decisions only; full context stays in the source file and the decide conversation. */
export function DecisionsCard({
  decisions,
  projectName,
  projectHref,
  error,
  nowIso,
}: {
  readonly decisions: readonly DecisionPoint[];
  readonly projectName: string;
  readonly projectHref: string;
  readonly error?: React.ReactNode;
  readonly nowIso?: string;
}): React.JSX.Element {
  const [selected, setSelected] = useState<DecisionPoint | null>(null);
  const visible = decisions.filter((decision) => !isEngineLogEntry(decision));
  const hidden = decisions.length - visible.length;
  const label = (decision: DecisionPoint) =>
    t(
      decision.resolved
        ? "workspace.resumen.decisions.resolved"
        : "workspace.resumen.decisions.pending",
    );
  function close(): void {
    setSelected(null);
  }
  return (
    <>
      <Card tone="amber">
        <CardHeader title={t("workspace.resumen.decisions.title")} icon="flag" />
        {error}
        {visible.length || !error ? (
          <>
            {hidden > 0 ? (
              <p className={styles.meta}>
                {t("workspace.resumen.decisions.hidden", { count: hidden })}
              </p>
            ) : null}
            {visible.length ? (
              <DividedList
                items={visible.map((decision) => ({
                  id: decision.id,
                  row: (
                    <ListRow
                      title={decision.title}
                      meta={decisionMeta(decision, nowIso)}
                      extra={
                        <Chip tone={decision.resolved ? "green" : "amber"}>{label(decision)}</Chip>
                      }
                      onClick={() => setSelected(decision)}
                    />
                  ),
                }))}
              />
            ) : (
              <p className={styles.empty}>{t("workspace.resumen.decisions.none")}</p>
            )}
          </>
        ) : null}
      </Card>
      {selected ? (
        <Modal
          open
          onClose={close}
          title={selected.title}
          kicker={t("dialogs.decision.kicker", { project: projectName })}
          tone="amber"
          testIdBase="decision"
          footer={
            <a className={styles.link} href={projectHref}>
              {t("dialogs.decision.openProject", { project: projectName })}
            </a>
          }
        >
          <div className={styles.dialogBody}>
            <div className={styles.chips}>
              <Chip tone={selected.resolved ? "green" : "amber"}>{label(selected)}</Chip>
              <Chip tone="slate">{projectName}</Chip>
              {selected.date ? <Chip tone="slate">{formatDate(selected.date)}</Chip> : null}
            </div>
            <p className={styles.meta}>{tRich("dialogs.decision.note")}</p>
            {selected.recommendation ? (
              <div>
                <h3>{t("dialogs.decision.recommendation")}</h3>
                <p>{selected.recommendation}</p>
              </div>
            ) : null}
            <p>
              {t(
                selected.resolved ? "dialogs.decision.runResolved" : "dialogs.decision.runPending",
              )}
            </p>
            <CmdRow
              variant="box"
              command={`/pandacorp:decide ${selected.id}`}
              copyLabel={t("common.copy.command", {
                command: `/pandacorp:decide ${selected.id}`,
              })}
            />
          </div>
        </Modal>
      ) : null}
    </>
  );
}
