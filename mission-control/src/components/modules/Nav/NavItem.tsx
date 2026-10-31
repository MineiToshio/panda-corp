import Link from "next/link";
import { Icon } from "@/components/core/Icon/Icon";
import type { NavDestination } from "@/lib/constants";
import { t } from "@/lib/copy/copy";
import styles from "./Nav.module.css";

/** A full-label sidebar destination with an alternate mini label for the tablet rail. */
export function NavItem({
  item,
  active,
  count,
}: {
  readonly item: NavDestination;
  readonly active: boolean;
  readonly count?: number;
}): React.JSX.Element {
  const showCount = count !== undefined && count > 0;
  const descriptionId = `nav-count-${item.id}`;
  const description =
    count === undefined
      ? ""
      : item.id === "inicio"
        ? t("shell.navCount.decisions", { count })
        : item.id === "propuestas"
          ? t("shell.navCount.proposals", { count })
          : String(count);
  return (
    <Link
      href={item.path}
      className={`navitem ${styles.item}`}
      data-tone={item.tone}
      data-testid={`app-nav-${item.id}`}
      aria-describedby={showCount ? descriptionId : undefined}
      aria-current={active ? "page" : undefined}
    >
      <Icon name={item.icon} />
      <span className={`lbl ${styles.label}`}>{t(item.labelKey)}</span>
      <span className={`mini ${styles.mini}`}>{t(item.miniKey)}</span>
      {showCount ? (
        <>
          <span className={item.id === "inicio" ? "alert count" : "count"} aria-hidden="true">
            {count}
          </span>
          <span id={descriptionId} className="sr-only" aria-hidden="true">
            {description}
          </span>
        </>
      ) : null}
      {item.id === "inicio" && count !== undefined && count > 0 ? (
        <span className="raildot" data-testid="inicio-rail-dot" aria-hidden="true" />
      ) : null}
    </Link>
  );
}
