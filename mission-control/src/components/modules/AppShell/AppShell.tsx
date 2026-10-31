"use client";

import { usePathname } from "next/navigation";
import { navActive } from "@/components/modules/Nav/navActive";
import styles from "./AppShell.module.css";
import { BottomNav } from "./BottomNav";
import { Sidebar, type SidebarSlots } from "./Sidebar";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";
import { useDrawer } from "./useDrawer";

export interface AppShellProps extends SidebarSlots {
  readonly children: React.ReactNode;
}

/** Persistent Órbita frame; owns the page main and all responsive navigation. */
export function AppShell({ children, ...slots }: AppShellProps): React.JSX.Element {
  const pathname = usePathname() ?? "";
  const active = navActive(pathname);
  const drawer = useDrawer(pathname);
  return (
    <>
      <SkipLink />
      <div
        id="app"
        className={`app ${styles.app}`}
        data-testid="app-shell"
        data-sidebar="expanded"
        data-hydrated={drawer.hydrated ? "true" : undefined}
      >
        <Sidebar
          {...slots}
          open={drawer.open}
          inert={drawer.isPhone && !drawer.open}
          sidebarRef={drawer.sidebar}
          onNavigate={drawer.handleNavigate}
        />
        <div
          id="scrim"
          className={`scrim ${styles.scrim}`}
          data-testid="drawer-scrim"
          aria-hidden="true"
          data-open={drawer.open}
        />
        <div className={`main ${styles.main}`}>
          <TopBar active={active} open={drawer.open} onOpen={drawer.handleOpen} />
          <main id="content" className={`page ${styles.page}`} tabIndex={-1}>
            {children}
          </main>
          <BottomNav active={active} onOpen={drawer.handleOpen} />
        </div>
      </div>
    </>
  );
}
