import Image from "next/image";
import Link from "next/link";
import type { Ref } from "react";
import { Nav } from "@/components/modules/Nav/Nav";
import { t } from "@/lib/copy/copy";
import styles from "./AppShell.module.css";

/** Server-derived content hosts, filled by the sidebar-contents work order. */
export interface SidebarSlots {
  readonly pills?: React.ReactNode;
  readonly projects?: React.ReactNode;
  readonly guild?: React.ReactNode;
  readonly footer?: React.ReactNode;
}

/** The same sidebar is a desktop column, tablet rail and phone drawer. */
export function Sidebar({
  pills,
  projects,
  guild,
  footer,
  open,
  inert,
  sidebarRef,
  onNavigate,
}: SidebarSlots & {
  readonly open: boolean;
  readonly inert: boolean;
  readonly sidebarRef: Ref<HTMLElement>;
  readonly onNavigate: React.MouseEventHandler<HTMLElement>;
}): React.JSX.Element {
  return (
    <aside
      id="sidebar"
      ref={sidebarRef}
      className={`sidebar ${styles.sidebar}`}
      aria-label={t("shell.sidebar.aria")}
      data-open={open}
      inert={inert}
      onClickCapture={onNavigate}
    >
      <Link className={`brand ${styles.brand}`} href="/" aria-label={t("shell.brand.aria")}>
        <Image src="/brand/pandacorp.png" alt="" width={34} height={34} priority />
        <div>
          <b>{t("shell.brand.name")}</b>
          <small>{t("shell.brand.product")}</small>
        </div>
      </Link>
      {pills}
      <Nav />
      {projects}
      {guild}
      {footer}
    </aside>
  );
}
