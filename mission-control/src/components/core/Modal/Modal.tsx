"use client";

import { useId, useRef } from "react";
import { IconButton } from "@/components/core/Button/IconButton";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { t } from "@/lib/copy/copy";
import styles from "./Dialog.module.css";
import { useModalLifecycle } from "./useModalLifecycle";

export interface ModalProps {
  /** Whether the modal is open and visible. */
  open: boolean;
  /** Invoked on backdrop click, the ✕ button, or Escape. */
  onClose: () => void;
  /** The dialog heading (also the default accessible name). */
  title: string;
  /**
   * Base for the data-testids: the panel is `${testIdBase}-modal`, the backdrop
   * `${testIdBase}-backdrop`, the close button `${testIdBase}-close`.
   */
  testIdBase: string;
  /** Optional accessible name override (defaults to `title`). */
  ariaLabel?: string;
  /** Optional node rendered before the title (e.g. a "TABLERO" badge). */
  badge?: React.ReactNode;
  /** Panel width (default 680px). */
  width?: number | string;
  /** Dialog header hue; defaults to slate. */
  tone?: Tone;
  /** Optional uppercase context label in the sticky header. */
  kicker?: string;
  /** Optional actions below the body. */
  footer?: React.ReactNode;
  /** Additional panel classes. */
  className?: string;
  /** Modal body. */
  children: React.ReactNode;
}

/** Native in-place dialog with a sticky tinted header and connected-opener focus return. */
export function Modal({
  open,
  onClose,
  title,
  testIdBase,
  ariaLabel,
  badge,
  width = 680,
  children,
  tone = "slate",
  kicker,
  footer,
  className,
}: ModalProps): React.JSX.Element | null {
  const panelRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useModalLifecycle({ open, panelRef, onClose });
  function handleCancel(event: React.SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    onClose();
  }
  function handleBackdrop(event: React.MouseEvent<HTMLDialogElement>): void {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      onClose();
  }
  if (!open) return null;
  return (
    <div className={styles.overlay}>
      {/* The native backdrop handles real browsers; this hook also supports non-dialog DOM hosts. */}
      <div
        data-testid={`${testIdBase}-backdrop`}
        aria-hidden="true"
        className={styles.backdrop}
        onClick={onClose}
      />
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: clicks outside dialog bounds dismiss; Escape uses native cancel */}
      <dialog
        ref={panelRef}
        id="dlg"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabel ? undefined : titleId}
        data-testid={`${testIdBase}-modal`}
        data-tone={tone}
        className={`${styles.dialog} ${className ?? ""}`}
        style={{ width }}
        tabIndex={-1}
        onCancel={handleCancel}
        onClick={handleBackdrop}
      >
        <div className={`dhead ${styles.head}`}>
          <div className={`dtitle ${styles.title}`}>
            {badge}
            {kicker ? <p className={`dkicker ${styles.kicker}`}>{kicker}</p> : null}
            <h2 id={titleId}>{title}</h2>
          </div>
          <IconButton
            data-testid={`${testIdBase}-close`}
            icon="x"
            label={`${t("dialogs.default.close")} modal`}
            onClick={onClose}
          />
        </div>
        <div className={`dbody ${styles.body}`}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </dialog>
    </div>
  );
}
