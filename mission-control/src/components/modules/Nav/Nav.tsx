"use client";

import { usePathname } from "next/navigation";
import { NAV_DESTINATIONS } from "@/lib/constants";
import { t } from "@/lib/copy/copy";
import styles from "./Nav.module.css";
import { NavItem } from "./NavItem";
import { navActive } from "./navActive";

/** The seven persistent destinations; route ownership comes from the canonical resolver. */
export type NavCounts = Readonly<Partial<Record<"inicio" | "tablero" | "propuestas", number>>>;

export function Nav({ counts = {} }: { readonly counts?: NavCounts }): React.JSX.Element {
  const active = navActive(usePathname() ?? "");
  return (
    <nav
      className={`navgroup ${styles.group}`}
      aria-label={t("shell.sidebar.sectionsAria")}
      data-testid="app-nav"
    >
      {NAV_DESTINATIONS.map((item) => (
        <NavItem
          key={item.id}
          item={item}
          active={active === item.id}
          count={
            item.id === "inicio" || item.id === "tablero" || item.id === "propuestas"
              ? counts[item.id]
              : undefined
          }
        />
      ))}
    </nav>
  );
}
