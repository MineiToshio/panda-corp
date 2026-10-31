import Link from "next/link";
import { Icon } from "@/components/core/Icon/Icon";
import type { NavDestination } from "@/lib/constants";
import { t } from "@/lib/copy/copy";
import styles from "./Nav.module.css";

/** A full-label sidebar destination with an alternate mini label for the tablet rail. */
export function NavItem({
  item,
  active,
}: {
  readonly item: NavDestination;
  readonly active: boolean;
}): React.JSX.Element {
  return (
    <Link
      href={item.path}
      className={`navitem ${styles.item}`}
      data-tone={item.tone}
      data-testid={`app-nav-${item.id}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon name={item.icon} />
      <span className={`lbl ${styles.label}`}>{t(item.labelKey)}</span>
      <span className={`mini ${styles.mini}`}>{t(item.miniKey)}</span>
    </Link>
  );
}
