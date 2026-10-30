import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import styles from "./Crumbs.module.css";

export interface Crumb {
  readonly label: string;
  /** Absent on the last item (the current page). */
  readonly href?: string;
}

export interface CrumbsProps {
  readonly items: readonly Crumb[];
}

/** Breadcrumb trail; the last item is the current page (`aria-current="page"`, not a link). */
export function Crumbs({ items }: CrumbsProps): React.JSX.Element {
  const last = items.length - 1;
  return (
    <nav className={`crumbs ${styles.crumbs}`} aria-label={t("common.breadcrumb.aria")}>
      {items.map((item, index) => (
        <span key={item.label} className="contents">
          {index === last || !item.href ? (
            <span aria-current={index === last ? "page" : undefined}>{item.label}</span>
          ) : (
            <a href={item.href}>{item.label}</a>
          )}
          {index === last ? null : <Icon name="chevR" size="sm" />}
        </span>
      ))}
    </nav>
  );
}
