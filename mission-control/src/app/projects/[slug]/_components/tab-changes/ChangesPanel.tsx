"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/core/Button/Button";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { DialogConfirm } from "@/components/core/Modal/DialogConfirm";
import { Modal } from "@/components/core/Modal/Modal";
import { FileReadErrors } from "@/components/modules/FileReadErrors/FileReadErrors";
import type { ChangeQueueReadResult } from "@/lib/changes/changes";
import { t } from "@/lib/copy/copy";
import { useUrlState } from "@/lib/navigation/useUrlState";
import { discardChangeAction } from "../../_actions/discard-change";
import { ChangeCard } from "./ChangeCard";
import { ChangeDetail } from "./ChangeDetail";
import {
  ACTIVE_STATUSES,
  discardErrorLabel,
  STATUS_TONES,
  statusLabel,
} from "./changePresentation";
import styles from "./changes.module.css";

const CHANGE_TYPE_KEYS = {
  bug: "workspace.cambios.typeBug",
  feature: "workspace.cambios.typeChange",
  change: "workspace.cambios.typeChange",
} as const;

export interface ChangesPanelProps {
  result: ChangeQueueReadResult;
  projectPath: string;
  slug: string;
}
/** Queue with visible in-flight groups, a single history and mutually exclusive dialogs. */
export function ChangesPanel({
  result: { items, errors },
  projectPath,
  slug,
}: ChangesPanelProps): React.JSX.Element {
  const [selectedId, setSelected] = useUrlState("change", "");
  const selected = items.find((item) => item.id === selectedId);
  const [confirming, setConfirming] = useState(false);
  const [previousSelectedId, setPreviousSelectedId] = useState(selectedId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const discardDone = useRef(false);
  if (previousSelectedId !== selectedId) {
    setPreviousSelectedId(selectedId);
    setConfirming(false);
    setError(null);
  }
  const history = items.filter((item) => item.status === "done" || item.status === "discarded");
  function close(): void {
    setSelected("");
    setConfirming(false);
    setError(null);
  }
  // Closing writes the URL, which would cancel the action's revalidated tree: wait for it to commit.
  useEffect(() => {
    if (pending || !discardDone.current) return;
    discardDone.current = false;
    setSelected("");
    setConfirming(false);
    setError(null);
  }, [pending, setSelected]);
  function confirm(reason: string): void {
    if (!selected || !canDiscard || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await discardChangeAction(projectPath, selected.id, slug, reason);
      if (result.ok) discardDone.current = true;
      else setError(discardErrorLabel(result.reason));
    });
  }
  const canDiscard = selected?.status === "ready" || selected?.status === "draft";
  const showConfirm = canDiscard && confirming;
  function cancelConfirm(): void {
    if (pending) return;
    setConfirming(false);
    setError(null);
  }
  return (
    <section
      data-testid="changes-panel"
      aria-label={t("workspace.cambios.request.title")}
      className={styles.stack}
    >
      <FileReadErrors
        heading={t("workspace.cambios.errors", { count: errors.length })}
        errors={errors.map((issue) => ({
          ...issue,
          file: `.pandacorp/inbox/changes/${issue.file}`,
        }))}
      />
      <div className={styles.strip}>
        {ACTIVE_STATUSES.map((status) => (
          <div key={status} data-tone={STATUS_TONES[status]}>
            <strong>{items.filter((item) => item.status === status).length}</strong>
            <span>{statusLabel(status)}</span>
          </div>
        ))}
      </div>
      {items.every((item) => !ACTIVE_STATUSES.some((status) => status === item.status)) &&
      !errors.length ? (
        <p>{t("workspace.cambios.empty")}</p>
      ) : null}
      {ACTIVE_STATUSES.map((status) => {
        const group = items.filter((item) => item.status === status);
        return group.length ? (
          <Card key={status} tone={STATUS_TONES[status]} variant="flush">
            <CardHeader title={statusLabel(status)} count={group.length} icon="layers" />
            {group.map((item) => (
              <ChangeCard key={item.id} item={item} onSelect={(item) => setSelected(item.id)} />
            ))}
          </Card>
        ) : null;
      })}
      {history.length ? (
        <details className={styles.history}>
          <summary>
            {t("workspace.cambios.history")} {history.length}
          </summary>
          {history.map((item) => (
            <ChangeCard key={item.id} item={item} onSelect={(item) => setSelected(item.id)} />
          ))}
        </details>
      ) : null}
      <Card tone="pink">
        <CardHeader title={t("workspace.cambios.request.title")} icon="plus" />
        <p>{t("workspace.cambios.request.intro")}</p>
        <CmdRow variant="box" command="/pandacorp:change" />
      </Card>
      <Modal
        open={!!selected && !showConfirm}
        onClose={close}
        title={selected?.title ?? ""}
        kicker={
          selected
            ? t("dialogs.change.kicker", {
                type: t(CHANGE_TYPE_KEYS[selected.type]),
                id: selected.id,
              })
            : undefined
        }
        testIdBase="change-detail-modal"
        tone="pink"
      >
        {selected ? <ChangeDetail item={selected} /> : null}
        {canDiscard ? (
          <Button onClick={() => setConfirming(true)}>{t("dialogs.change.discard")}</Button>
        ) : null}
      </Modal>
      <DialogConfirm
        open={!!selected && showConfirm}
        title={t("dialogs.confirm.discardChange.title")}
        testIdBase="change-discard"
        reasonLabel={t("dialogs.confirm.reasonLabel")}
        cancelLabel={t("dialogs.confirm.cancel")}
        confirmLabel={t("dialogs.confirm.discardChange.verb")}
        kicker={t("dialogs.confirm.kicker")}
        confirmVariant="danger"
        onCancel={cancelConfirm}
        onConfirm={confirm}
      >
        <p>{t("dialogs.confirm.discardChange.text")}</p>
        {error ? <p role="alert">{error}</p> : null}
      </DialogConfirm>
    </section>
  );
}
