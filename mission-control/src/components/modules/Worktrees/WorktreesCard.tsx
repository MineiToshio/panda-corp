"use client";
import { useState } from "react";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Notice } from "@/components/core/Notice/Notice";
import { t, tRich } from "@/lib/copy/copy";
import { WORKTREES_CARD_ID } from "@/lib/pendingMerge/repoState";
import type { WorktreesByRepo, WorktreesRepo } from "@/lib/pendingMerge/worktreesByRepo";
import styles from "./Worktrees.module.css";
import { WorktreesBranchDialog } from "./WorktreesBranchDialog";
import { WorktreesTable } from "./WorktreesTable";
export function WorktreesCard({ rows }: { readonly rows: WorktreesByRepo }): React.JSX.Element {
  const [selected, setSelected] = useState<WorktreesRepo | null>(null);
  return (
    <div id={WORKTREES_CARD_ID} className={styles.root} data-testid="factory-worktrees">
      <Card tone="teal">
        <CardHeader title={t("inicio.worktrees.title")} icon="branch" />
        <p className={styles.muted}>{tRich("inicio.worktrees.intro")}</p>
        <div className={`skill-line ${styles.skill}`}>
          <span>{t("inicio.worktrees.cleanupHint")}</span>
          <CmdRow
            command="/pandacorp:worktrees"
            variant="box"
            copyLabel={t("common.copy.command", { command: "/pandacorp:worktrees" })}
          />
        </div>
        <WorktreesTable rows={rows} onSelect={setSelected} />
        <p className={`tbl-hint ${styles.hint}`}>{t("states.scrollable.tableHint")}</p>
        <details className={`legend ${styles.legend}`} data-testid="worktrees-legend">
          <summary>{t("inicio.worktrees.legendSummary")}</summary>
          <p>{tRich("inicio.worktrees.legendBody")}</p>
        </details>
        {rows.map((row) =>
          row.kind === "error" ? (
            <Notice key={row.path} icon="alert" kind="error">
              {tRich("inicio.worktrees.unreadableNoteWithReason", {
                project: row.name,
                reason: row.reason,
              })}
            </Notice>
          ) : null,
        )}
      </Card>
      <WorktreesBranchDialog repository={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
