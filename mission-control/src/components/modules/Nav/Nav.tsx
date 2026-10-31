"use client";

import { usePathname } from "next/navigation";
import { NAV_DESTINATIONS } from "@/lib/constants";
import { t } from "@/lib/copy/copy";
import styles from "./Nav.module.css";
import { NavItem } from "./NavItem";
import { navActive } from "./navActive";

/** The seven persistent destinations; route ownership comes from the canonical resolver. */
export function Nav(): React.JSX.Element {
  const active = navActive(usePathname() ?? "");
  return (
    <nav
      className={`navgroup ${styles.group}`}
      aria-label={t("shell.sidebar.sectionsAria")}
      data-testid="app-nav"
    >
      {NAV_DESTINATIONS.map((item) => (
        <NavItem key={item.id} item={item} active={active === item.id} />
      ))}
    </nav>
  );
}
