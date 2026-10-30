import { type Crumb, Crumbs } from "@/components/core/Crumbs/Crumbs";
import styles from "./PageHead.module.css";

export interface PageHeadProps {
  /** The page's ONE h1: the nav label on top-level pages, the item's own name on drill-ins. */
  readonly title: string;
  readonly subtitle?: string;
  readonly crumbs?: readonly Crumb[];
  /** Slot above the title (for example the capture stamp). */
  readonly eyebrow?: React.ReactNode;
  readonly actions?: React.ReactNode;
}

/** Page title block. Never renders a `<main>`: the shell owns the landmark. */
export function PageHead({
  title,
  subtitle,
  crumbs,
  eyebrow,
  actions,
}: PageHeadProps): React.JSX.Element {
  return (
    <header className={`pagehead ${styles.head}`}>
      <div className={`titles ${styles.titles}`}>
        {crumbs ? <Crumbs items={crumbs} /> : null}
        {eyebrow}
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </header>
  );
}
