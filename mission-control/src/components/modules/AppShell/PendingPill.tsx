import Link from "next/link";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import type { summarizeWorktrees } from "@/lib/pendingMerge/pillSummary";
import { WORKTREES_CARD_ID } from "@/lib/pendingMerge/repoState";

export function PendingPill({
  summary,
}: {
  readonly summary: ReturnType<typeof summarizeWorktrees>;
}): React.JSX.Element | null {
  if (summary.hidden) return null;
  const alert = summary.urgent || summary.unreadable > 0;
  const label =
    (summary.count
      ? t("shell.pending.label", { count: summary.count })
      : t("shell.pending.labelNone")) +
    (summary.unreadable
      ? t("shell.pending.labelUnread")
      : summary.urgent
        ? t("shell.pending.labelUrgent")
        : "");
  const title =
    t("shell.pending.titleBranches", { count: summary.count }) +
    (summary.unreadable ? t("shell.pending.titleUnread", { count: summary.unreadable }) : "") +
    t("shell.pending.titleSuffix");
  return (
    <Link
      href={`/#${WORKTREES_CARD_ID}`}
      className="plugin-pill pending-pill"
      data-tone={alert ? "coral" : "slate"}
      data-volatile
      title={title}
    >
      <Icon name={alert ? "alert" : "branch"} size="sm" />
      <span className="lbl">{label}</span>
      <span className="sr-only">{title}</span>
    </Link>
  );
}
