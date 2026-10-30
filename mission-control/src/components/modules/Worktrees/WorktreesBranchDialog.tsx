import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Modal } from "@/components/core/Modal/Modal";
import { t } from "@/lib/copy/copy";
import type { WorktreesRepo } from "@/lib/pendingMerge/worktreesByRepo";
import styles from "./Worktrees.module.css";
export function WorktreesBranchDialog({
  repository,
  onClose,
}: {
  readonly repository: WorktreesRepo | null;
  readonly onClose: () => void;
}): React.JSX.Element | null {
  if (repository?.kind !== "ok") return null;
  const row = repository;
  return (
    <div className={styles.dialog} data-tone="teal">
      <Modal
        open
        onClose={onClose}
        title={t("inicio.worktrees.detail.title", { repo: row.name })}
        testIdBase="worktrees"
        width="calc(var(--s10) * 17)"
        badge={<span className={styles.kicker}>{t("inicio.worktrees.detail.kicker")}</span>}
      >
        <p className={styles.muted}>
          {t("inicio.worktrees.detail.summary", {
            branches: t("inicio.worktrees.detail.branches", { count: row.branches.length }),
            leftovers: t("inicio.worktrees.detail.leftovers", { count: row.leftovers }),
            locked: row.locked ? t("inicio.worktrees.detail.locked", { count: row.locked }) : "",
          })}
        </p>
        <div>
          {row.branches.map((branch) => (
            <div className={`ask-row ${styles.branch}`} key={branch.name}>
              <BadgeIcon icon="branch" size="sm" />
              <div>
                <strong className={styles.subject}>{branch.subject}</strong>
                <p className={styles.meta}>
                  {t("inicio.worktrees.detail.meta", {
                    origin: t(`inicio.worktrees.origin.${branch.origin}`),
                    age:
                      branch.ageHours < 48
                        ? t("inicio.worktrees.detail.ageHours", {
                            hours: Math.floor(branch.ageHours),
                          })
                        : t("inicio.worktrees.detail.ageDays", {
                            days: Math.floor(branch.ageHours / 24),
                          }),
                    commits: t("inicio.worktrees.detail.commits", { count: branch.ahead }),
                  })}
                  {branch.uncommitted
                    ? t("inicio.worktrees.detail.uncommitted", { count: branch.uncommitted })
                    : ""}
                </p>
                <p className={styles.name}>{branch.name}</p>
              </div>
            </div>
          ))}
        </div>
        <p className={styles.muted}>{t("inicio.worktrees.detail.run", { repo: row.name })}</p>
        <CmdRow
          command="/pandacorp:worktrees"
          variant="box"
          copyLabel="Copiar /pandacorp:worktrees"
        />
      </Modal>
    </div>
  );
}
