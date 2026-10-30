"use client";

import { t } from "@/lib/copy/copy";
import styles from "./CopyText.module.css";

export interface CopyTextProps {
  /** The exact text that is shown and copied. */
  readonly text: string;
  /** Called with `true` once copied, `false` when the clipboard is blocked: the caller raises the matching toast. */
  readonly onResult?: (copied: boolean) => void;
}

/** Click-to-copy text. The «Copiar» hint is a hover/focus tooltip; its name is the visible text plus the action. */
export function CopyText({ text, onResult }: CopyTextProps): React.JSX.Element {
  async function handleClick(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      onResult?.(true);
    } catch {
      onResult?.(false);
    }
  }
  return (
    <button
      type="button"
      className={`copy-text ${styles.copy}`}
      data-hint={t("common.copy.hint")}
      aria-label={t("common.copy.command", { command: text })}
      onClick={handleClick}
    >
      {text}
    </button>
  );
}
