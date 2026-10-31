"use client";

import { useEffect, useId, useState } from "react";
import { Button } from "@/components/core/Button/Button";
import styles from "./Dialog.module.css";
import { Modal } from "./Modal";

export interface DialogConfirmProps {
  readonly open: boolean;
  readonly title: string;
  readonly testIdBase: string;
  /** Spanish labels from the catalogue. */
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  /** When set, a labelled reason field is shown and its text is passed to `onConfirm`. */
  readonly reasonLabel?: string;
  readonly reasonPlaceholder?: string;
  readonly confirmVariant?: "primary" | "danger";
  readonly onCancel: () => void;
  readonly onConfirm: (reason: string) => void;
  readonly children?: React.ReactNode;
}

/** Confirmation dialog on the shared Modal (focus trap, Escape, focus return): Cancelar and a verb, optional reason. */
export function DialogConfirm({
  open,
  title,
  testIdBase,
  cancelLabel,
  confirmLabel,
  reasonLabel,
  reasonPlaceholder,
  confirmVariant = "primary",
  onCancel,
  onConfirm,
  children,
}: DialogConfirmProps): React.JSX.Element | null {
  const reasonId = useId();
  const [reason, setReason] = useState("");
  useEffect(() => {
    if (open) setReason("");
  }, [open]);
  function handleReason(event: React.ChangeEvent<HTMLTextAreaElement>): void {
    setReason(event.target.value);
  }
  function handleConfirm(): void {
    onConfirm(reason);
  }
  return (
    <Modal open={open} onClose={onCancel} title={title} testIdBase={testIdBase}>
      {children}
      {reasonLabel ? (
        <div>
          <label htmlFor={reasonId} className={styles.label}>
            {reasonLabel}
          </label>
          <textarea
            data-testid={`${testIdBase}-reason-text`}
            placeholder={reasonPlaceholder}
            id={reasonId}
            className={styles.reason}
            value={reason}
            onChange={handleReason}
          />
        </div>
      ) : null}
      <div className={styles.actions}>
        <Button onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={confirmVariant} onClick={handleConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
