import { Markdown } from "@/components/core/Markdown/Markdown";
import { t } from "@/lib/copy/copy";
import styles from "./detail.module.css";
/** Fold both paragraph notes and the engine's long, single-list notes after their first two blocks. */
export function StatusNote({ body }: { body: string }): React.JSX.Element {
  const blocks = body.trim().split(/\n\s*\n|\n(?=(?:[-*]|\d+\.)\s)/);
  return (
    <>
      <Markdown>{blocks.slice(0, 2).join("\n\n")}</Markdown>
      {blocks.length > 2 && (
        <details className={`wo-more ${styles.more}`}>
          <summary>{t("workspace.observabilidad.detail.readMore")}</summary>
          <Markdown>{blocks.slice(2).join("\n\n")}</Markdown>
        </details>
      )}
    </>
  );
}
