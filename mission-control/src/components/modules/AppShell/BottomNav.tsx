import Link from "next/link";
import { Icon } from "@/components/core/Icon/Icon";
import { NAV_DESTINATIONS, type NavDestinationId } from "@/lib/constants";
import { t } from "@/lib/copy/copy";
import styles from "./AppShell.module.css";

const SHORTCUTS = NAV_DESTINATIONS.filter((item) =>
  ["inicio", "tablero", "portfolio", "documentacion"].includes(item.id),
);

/** Four phone shortcuts and the second drawer opener. */
export function BottomNav({
  active,
  onOpen,
}: {
  readonly active: NavDestinationId | null;
  readonly onOpen: React.MouseEventHandler<HTMLButtonElement>;
}): React.JSX.Element {
  return (
    <nav
      id="bottomnav"
      className={`bottomnav ${styles.bottomnav}`}
      aria-label={t("shell.bottomNav.aria")}
    >
      {SHORTCUTS.map((item) => (
        <Link
          key={item.id}
          href={item.path}
          data-tone={item.tone}
          aria-current={active === item.id ? "page" : undefined}
        >
          <Icon name={item.icon} />
          <span>{t(item.miniKey)}</span>
        </Link>
      ))}
      <button type="button" data-action="drawer" aria-controls="sidebar" onClick={onOpen}>
        <Icon name="menu" />
        <span>{t("shell.bottomNav.more")}</span>
      </button>
    </nav>
  );
}
