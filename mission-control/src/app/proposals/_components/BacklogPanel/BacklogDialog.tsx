"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/core/Button/Button";
import { Modal } from "@/components/core/Modal/Modal";
import { Notice } from "@/components/core/Notice/Notice";
import type { BacklogItem } from "@/lib/backlog/backlog";
import { t } from "@/lib/copy/copy";
import { discardBacklogAction } from "../../_actions/discard-backlog";
import { BacklogDetail } from "./BacklogDetail";
import styles from "./BacklogPanel.module.css";
import { PRIORITY_TONE } from "./backlogPresentation";
/** One native dialog alternates item detail and a bounded discard confirmation. */
export function BacklogDialog({
  item,
  confirming,
  onConfirmView,
  onClose,
  onDiscarded,
}: {
  readonly item: BacklogItem;
  readonly confirming: boolean;
  readonly onConfirmView: (confirming: boolean) => void;
  readonly onClose: () => void;
  readonly onDiscarded: () => void;
}): React.JSX.Element {
  const [reason, setReason] = useState("");
  const [result, action, pending] = useActionState(
    async (_previous: { ok: boolean; reason?: string } | null, data: FormData) => {
      const result = await discardBacklogAction(item.id, data.get("reason"));
      // Close before the revalidated tree commits: its item-path key would remount this panel.
      if (result.ok) onDiscarded();
      return result;
    },
    null,
  );
  const error = result && !result.ok ? result.reason : null;
  return (
    <Modal
      open
      onClose={confirming ? () => onConfirmView(false) : onClose}
      title={confirming ? t("dialogs.confirm.discardBacklog.title") : `${item.id} · ${item.title}`}
      testIdBase={confirming ? "backlog-discard" : "backlog-detail"}
      tone={item.severity ? PRIORITY_TONE[item.severity] : "slate"}
      kicker={
        confirming
          ? t("dialogs.confirm.kicker")
          : t("dialogs.backlogItem.kicker", {
              priority: item.severity?.toUpperCase() ?? t("propuestas.backlog.noPriority"),
            })
      }
    >
      {confirming ? (
        <form action={action} className={styles.dialog}>
          <p>{t("dialogs.confirm.discardBacklog.text")}</p>
          <label htmlFor="backlog-reason">{t("dialogs.confirm.reasonLabel")}</label>
          <textarea
            className={styles.reason}
            id="backlog-reason"
            name="reason"
            placeholder={t("dialogs.confirm.reasonPlaceholder")}
            aria-invalid={error !== null}
            aria-describedby={error ? "backlog-discard-error" : undefined}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          {error && (
            <Notice kind="error" icon="alert">
              <span id="backlog-discard-error">
                {t(
                  error === "parse-error"
                    ? "inicio.worktrees.unreadable"
                    : "dialogs.account.access.unavailable",
                )}{" "}
                · {item.id}
              </span>
            </Notice>
          )}
          <div className={styles.chips}>
            <Button onClick={() => onConfirmView(false)} disabled={pending}>
              {t("dialogs.confirm.cancel")}
            </Button>
            <Button variant="danger" type="submit" disabled={pending}>
              {t("dialogs.confirm.discardBacklog.verb")}
            </Button>
          </div>
        </form>
      ) : (
        <BacklogDetail item={item} onConfirm={() => onConfirmView(true)} />
      )}
    </Modal>
  );
}
