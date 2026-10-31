import type { ReactNode } from "react";
import { Chip } from "@/components/core/Chip/Chip";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import styles from "./DocumentReader.module.css";

/** Typed document paper; children are rendered by the caller's shared Markdown. */
export function Paper({
  type,
  path,
  children,
  tone = "violet",
}: {
  readonly type: string;
  readonly path: string;
  readonly children: ReactNode;
  readonly tone?: Tone;
}): React.JSX.Element {
  return (
    <article className={`paper ${styles.paper}`} data-tone={tone}>
      <header className={`paper-head ${styles.paperHead}`}>
        <Chip tone={tone}>{type}</Chip>
        <code className={styles.path}>{path}</code>
        <CopyButton value={path} />
      </header>
      {children}
    </article>
  );
}
