import Image from "next/image";
import Link from "next/link";
import { type Ref, useState } from "react";
import { Nav, type NavCounts } from "@/components/modules/Nav/Nav";
import { t } from "@/lib/copy/copy";
import styles from "./AppShell.module.css";

/** Server-derived content hosts, filled by the sidebar-contents work order. */
export interface SidebarSlots {
  readonly counts?: NavCounts;
  readonly pills?: React.ReactNode;
  readonly projects?: React.ReactNode;
  readonly guild?: React.ReactNode;
  readonly footer?: React.ReactNode;
}

/** The same sidebar is a desktop column, tablet rail and phone drawer. */
export function Sidebar({
  pills,
  counts,
  collapsed,
  projects,
  guild,
  footer,
  open,
  inert,
  sidebarRef,
  onNavigate,
}: SidebarSlots & {
  readonly collapsed?: boolean;
  readonly open: boolean;
  readonly inert: boolean;
  readonly sidebarRef: Ref<HTMLElement>;
  readonly onNavigate: React.MouseEventHandler<HTMLElement>;
}): React.JSX.Element {
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  const floating = Boolean(collapsed && (pointerInside || focusInside));
  return (
    <aside
      id="sidebar"
      ref={sidebarRef}
      className={`sidebar ${styles.sidebar}`}
      aria-label={t("shell.sidebar.aria")}
      data-open={open}
      data-float={floating}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch" && window.matchMedia?.("(hover: hover)").matches)
          setPointerInside(true);
      }}
      onPointerLeave={() => setPointerInside(false)}
      onFocusCapture={(event) => {
        if (event.target instanceof HTMLElement && event.target.matches(":focus-visible"))
          setFocusInside(true);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocusInside(false);
      }}
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
      <Nav counts={counts} />
      {projects}
      {guild}
      {footer}
      <style>{SIDEBAR_CONTENT_STYLES}</style>
    </aside>
  );
}

const SIDEBAR_CONTENT_STYLES = `
#sidebar .navitem .count { margin-left: auto; font-size: var(--fs-xs); color: var(--text-3); font-variant-numeric: tabular-nums; }
#sidebar .navitem .count.alert { color: var(--amber); font-weight: 700; }
#sidebar .raildot { display: none; }
#sidebar .projnav { display: grid; gap: var(--s1); }
html[data-projects-open="false"] #sidebar .projnav[data-ready="false"] #projlist { display: none; }
#sidebar .navlabel { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: var(--s2); border: 0; border-radius: var(--r-md); background: transparent; color: var(--text-3); font: 650 var(--fs-xs)/1.4 var(--font-body); letter-spacing: .08em; text-transform: uppercase; cursor: pointer; min-height: var(--s10); }
#sidebar .projnav[data-folded="true"] .navlabel { background: var(--surface-3); border-radius: var(--r-pill); }
#sidebar #projlist:not([hidden]) { display: grid; gap: var(--s1); }
#sidebar .project-nav-item { display: flex; align-items: center; gap: var(--s2); padding: var(--s2); min-height: calc(var(--s10) + var(--s1)); text-decoration: none; border-radius: var(--r-md); }
#sidebar .project-nav-item .meta { display: grid; min-width: 0; line-height: 1.2; }
#sidebar .project-nav-item .meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#sidebar .project-nav-item small { font-size: var(--fs-xs); color: var(--text-2); }
#sidebar .see-all { display: block; padding: var(--s2); font-size: var(--fs-xs); color: var(--text-2); }
#sidebar .plugin-pill { display: flex; align-items: center; gap: var(--s2); min-height: calc(var(--s8) + var(--s1)); padding: 0 var(--s2); border-radius: var(--r-md); text-decoration: none; font-size: var(--fs-sm); font-weight: 650; color: var(--tone); background: color-mix(in srgb, var(--tone) var(--tint-strong), transparent); border: var(--hairline) solid color-mix(in srgb, var(--tone) 45%, transparent); }
#sidebar .plugin-pill + .pending-pill { margin-top: calc(var(--s1) - var(--s4)); }
#sidebar .side-foot { position: sticky; bottom: 0; z-index: 1; display: flex; gap: var(--s2); align-items: stretch; justify-content: center; background: var(--bg-2); }
#sidebar:not(:has(.guildcard)) .side-foot { margin-top: auto; }
#sidebar .side-toggle, #sidebar .theme-btn { display: inline-flex; flex: none; align-items: center; justify-content: center; gap: var(--s2); min-width: var(--s10); min-height: var(--s10); padding: 0 var(--s2); border: var(--hairline) solid var(--line); border-radius: var(--r-md); background: transparent; color: var(--text-2); font: 600 var(--fs-sm)/1.4 var(--font-body); cursor: pointer; }
#sidebar .side-toggle { flex: 1 1 auto; min-width: 0; }
#sidebar .theme-btn .lbl { display: none; }
@media (hover: hover) {
  #sidebar :is(.theme-btn,.side-toggle,.project-nav-item,.navlabel):hover { background: var(--surface-2); color: var(--text); }
}
@media (min-width: 760px) and (max-width: 1179px) {
  #sidebar :is(.plugin-pill .lbl,.projnav .meta,.see-all,.navlabel > span,.guildcard .gtext,.guildcard .bar,.navitem .count) { display: none; }
  #sidebar :is(.plugin-pill,.project-nav-item) { justify-content: center; padding-inline: 0; }
  #sidebar .navlabel { justify-content: center; }
  #sidebar .guildcard { padding: var(--s2); }
  #sidebar .guildcard > div { justify-content: center; }
  #sidebar .navitem .raildot { display: block; position: absolute; top: var(--s1); right: var(--s1); width: var(--s2); height: var(--s2); border-radius: var(--r-pill); background: var(--amber); }
}
@media (max-width: 1179px) { #sidebar .theme-btn { min-width: calc(var(--s10) + var(--s1)); min-height: calc(var(--s10) + var(--s1)); } }
@media (max-width: 759px) {
  #sidebar .side-foot { display: block; }
  #sidebar .theme-btn { width: 100%; justify-content: flex-start; }
  #sidebar .theme-btn .lbl { display: inline; }
}
@media (min-width: 1180px) {
  #app[data-sidebar="collapsed"], html[data-sidebar-pref="collapsed"] #app:not([data-hydrated="true"]) { grid-template-columns: var(--rail-c) minmax(0, 1fr); }
  #app[data-sidebar="collapsed"] #sidebar, html[data-sidebar-pref="collapsed"] #app:not([data-hydrated="true"]) #sidebar { width: var(--rail-c); padding-inline: var(--s2); overflow-x: hidden; }
  #app[data-sidebar="collapsed"] #sidebar[data-float="true"] { width: var(--sidebar); padding-inline: var(--s3); box-shadow: var(--shadow-panel); }
  #app[data-sidebar="collapsed"] #sidebar:not([data-float="true"]) :is(.brand > div,.navlabel > span,.navlabel > svg,.navitem .lbl,.navitem .count,.projnav .meta,.guildcard .gtext,.guildcard .bar,.plugin-pill .lbl,.side-toggle .lbl,.see-all),
  html[data-sidebar-pref="collapsed"] #app:not([data-hydrated="true"]) #sidebar :is(.brand > div,.navlabel > span,.navlabel > svg,.navitem .lbl,.navitem .count,.projnav .meta,.guildcard .gtext,.guildcard .bar,.plugin-pill .lbl,.side-toggle .lbl,.see-all) { display: none; }
  #app[data-sidebar="collapsed"] #sidebar:not([data-float="true"]) :is(.brand,.navitem,.plugin-pill,.side-toggle,.guildcard > div) { justify-content: center; padding-inline: 0; }
  #app[data-sidebar="collapsed"] #sidebar:not([data-float="true"]) .guildcard { padding: var(--s2); }
  #app[data-sidebar="collapsed"] #sidebar:not([data-float="true"]) .navlabel { justify-content: center; padding: var(--s2) 0 var(--s1); }
  #app[data-sidebar="collapsed"] #sidebar:not([data-float="true"]) .navlabel::after { content: ""; width: var(--s6); height: var(--hairline); background: var(--line-strong); }
  #app[data-sidebar="collapsed"] #sidebar:not([data-float="true"]) .navitem .raildot { display: block; position: absolute; top: var(--s1); right: var(--s1); width: var(--s2); height: var(--s2); border-radius: var(--r-pill); background: var(--amber); box-shadow: 0 0 0 var(--hairline) var(--bg-2); }
  #app[data-sidebar="collapsed"] #sidebar .side-foot { flex-direction: column; gap: var(--s1); }
  #app[data-sidebar="collapsed"] #sidebar[data-float="true"] .theme-btn { justify-content: flex-start; }
  #app[data-sidebar="collapsed"] #sidebar[data-float="true"] .theme-btn .lbl { display: inline; }
  #app[data-sidebar="collapsed"] #sidebar :is(.lbl,.meta,.gtext,.count) { white-space: nowrap; }
}
`;
