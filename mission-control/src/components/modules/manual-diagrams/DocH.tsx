import type React from "react";
import { headingId } from "@/components/core/Markdown/headingAnchors";
import styles from "./DocH.module.css";

export interface DocHProps {
  /** Heading text. */
  title: string;
  /** Explicit stable fragment override when a document repeats a heading. */
  id?: string;
  /** Heading level (1–3). The shell owns the page h1. */
  level?: 1 | 2 | 3;
}

/** Authored Manual heading with the approved plain typography and stable fragment. */
export function DocH({ title, id, level = 2 }: DocHProps): React.JSX.Element {
  const HeadingTag = `h${level}` as const;
  return (
    <div data-testid="manual-doc-h" className={styles.heading}>
      <HeadingTag id={id ?? headingId(title)}>{title}</HeadingTag>
    </div>
  );
}
