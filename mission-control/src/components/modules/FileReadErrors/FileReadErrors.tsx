import { Notice } from "@/components/core/Notice/Notice";
import { type CopyKey, t } from "@/lib/copy/copy";
import type { WorkOrderReadError } from "@/lib/work-orders/published";
import styles from "./FileReadErrors.module.css";

const REASONS: Readonly<Record<string, CopyKey>> = {
  "malformed YAML frontmatter": "readerFailures.malformedYaml",
  "invalid implementation_status": "readerFailures.invalidStatus",
  "file could not be read": "readerFailures.unreadableFile",
  "file is empty": "readerFailures.emptyFile",
};
/** Shared file-level notice: each failed source keeps its own path and reason beside valid data. */
export function FileReadErrors({
  errors,
  heading,
}: {
  readonly errors: readonly WorkOrderReadError[];
  readonly heading?: React.ReactNode;
}): React.JSX.Element | null {
  if (!errors.length) return null;
  return (
    <Notice icon="alert" kind="error">
      <div className={styles.errors}>
        <p>{heading ?? t("readerFailures.unreadFiles", { count: errors.length })}</p>
        <ul>
          {errors.map((issue) => (
            <li key={issue.file}>
              <code>{issue.file}</code>:{" "}
              {REASONS[issue.reason]
                ? t(REASONS[issue.reason] ?? "readerFailures.unreadableFile")
                : issue.reason}
            </li>
          ))}
        </ul>
        {errors.some((issue) => issue.file.startsWith("docs/frds/")) ? (
          <p>{t("readerFailures.partialPlan")}</p>
        ) : null}
      </div>
    </Notice>
  );
}
