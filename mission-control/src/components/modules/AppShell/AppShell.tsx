"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/core/Icon/Icon";
import { navActive } from "@/components/modules/Nav/navActive";
import { t } from "@/lib/copy/copy";
import styles from "./AppShell.module.css";
import { BottomNav } from "./BottomNav";
import { Sidebar, type SidebarSlots } from "./Sidebar";
import { SkipLink } from "./SkipLink";
import { TopBar } from "./TopBar";
import { useDrawer } from "./useDrawer";
import { useSidebarPreference } from "./useSidebarPreference";

export interface AppShellProps extends SidebarSlots {
  readonly location?: React.ReactNode;
  readonly children: React.ReactNode;
}

/** Persistent Órbita frame; owns the page main and all responsive navigation. */
export function AppShell({
  children,
  footer,
  location,
  ...slots
}: AppShellProps): React.JSX.Element {
  const pathname = usePathname() ?? "";
  const active = navActive(pathname);
  const preference = useSidebarPreference();
  const drawer = useDrawer(pathname);
  const collapsed = preference.collapsed;
  return (
    <>
      <SkipLink />
      <div
        id="app"
        className={`app ${styles.app}`}
        data-testid="app-shell"
        data-sidebar={collapsed ? "collapsed" : "expanded"}
        data-hydrated={drawer.hydrated ? "true" : undefined}
      >
        <Sidebar
          {...slots}
          collapsed={collapsed && preference.desktop}
          footer={
            footer !== undefined ? (
              <SidebarFooter
                collapsed={collapsed}
                desktop={preference.desktop}
                onToggle={preference.toggle}
              >
                {footer}
              </SidebarFooter>
            ) : undefined
          }
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
          <TopBar
            location={location}
            active={active}
            open={drawer.open}
            onOpen={drawer.handleOpen}
          />
          <main id="content" className={`page ${styles.page}`} tabIndex={-1}>
            {children}
          </main>
          <BottomNav active={active} onOpen={drawer.handleOpen} />
        </div>
      </div>
    </>
  );
}

function SidebarFooter({
  collapsed,
  desktop,
  onToggle,
  children,
}: {
  readonly collapsed: boolean;
  readonly desktop: boolean;
  readonly onToggle: () => void;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="side-foot">
      {desktop ? (
        <button
          type="button"
          className="side-toggle"
          data-action="toggle-sidebar"
          aria-pressed={collapsed}
          aria-label={t(collapsed ? "shell.sidebar.pin" : "shell.sidebar.collapse")}
          onClick={onToggle}
        >
          <Icon name={collapsed ? "panelOpen" : "panelClose"} />
          <span className="lbl">
            {t(collapsed ? "shell.sidebar.pinShort" : "shell.sidebar.collapseShort")}
          </span>
        </button>
      ) : null}
      {children}
    </div>
  );
}
