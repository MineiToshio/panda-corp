import { t } from "@/lib/copy/copy";
import styles from "./AppShell.module.css";

/** First focusable control, targeting the shell main without navigating away. */
export function SkipLink(): React.JSX.Element {
  function handleSkip() {
    document.getElementById("content")?.focus();
  }
  return (
    // biome-ignore lint/a11y/useValidAnchor: A skip link navigates to an in-page anchor and explicitly focuses that target.
    <a className={`skip ${styles.skip}`} href="#content" onClick={handleSkip}>
      {t("shell.skipLink")}
    </a>
  );
}
