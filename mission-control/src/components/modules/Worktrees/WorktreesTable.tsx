import { Chip } from "@/components/core/Chip/Chip";
import { Table } from "@/components/core/Table/Table";
import { t } from "@/lib/copy/copy";
import type { WorktreesByRepo, WorktreesRepo } from "@/lib/pendingMerge/worktreesByRepo";
import styles from "./Worktrees.module.css";

const tones = {
  cleanNow: "coral",
  reviewSoon: "amber",
  upToDate: "green",
  clean: "green",
} as const;
export function WorktreesTable({
  rows,
  onSelect,
}: {
  readonly rows: WorktreesByRepo;
  readonly onSelect: (row: WorktreesRepo) => void;
}): React.JSX.Element {
  return (
    <section
      className={`wt-table ${styles.table}`}
      aria-label={t("states.scrollable.tableAria")}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: horizontal scroll region must be keyboard reachable
      tabIndex={0}
    >
      <Table
        caption={t("inicio.worktrees.title")}
        columns={[
          { id: "project", label: t("inicio.worktrees.columns.project") },
          { id: "unmerged", label: t("inicio.worktrees.columns.unmerged") },
          { id: "leftovers", label: t("inicio.worktrees.columns.leftovers") },
          { id: "state", label: t("inicio.worktrees.columns.state") },
        ]}
        rows={rows.map((row) => ({
          id: row.path,
          cells: {
            project: (
              <button
                type="button"
                className={`link ${styles.link}`}
                data-wt-repo={row.path.split("/").pop()}
                data-testid={`worktrees-repo-${row.path.split("/").pop()}`}
                disabled={row.kind === "error" || (!row.branches.length && !row.leftovers)}
                onClick={() => onSelect(row)}
              >
                {row.name}
              </button>
            ),
            unmerged: row.kind === "ok" && row.branches.length ? row.branches.length : "—",
            leftovers: row.kind === "ok" && row.leftovers ? row.leftovers : "—",
            state:
              row.kind === "error" ? (
                <Chip tone="coral">{t("inicio.worktrees.unreadable")}</Chip>
              ) : (
                <span className={`state-dot ${styles.state}`} data-tone={tones[row.state]}>
                  <span aria-hidden="true" />
                  {t(`inicio.worktrees.states.${row.state}`)}
                </span>
              ),
          },
        }))}
      />
    </section>
  );
}
