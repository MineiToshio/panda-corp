/**
 * Shared `.tab` nav-pill visual + active-match (FRD-19, CMP-19-nav).
 *
 * The persistent topbar destinations (`Nav`) and the Propuestas destination (`ProposalsBadge`) are
 * real `next/link`s styled as the prototype's `.tab` pill (index.html L62–63 / `Tabs.topTabStyle`),
 * NOT `<button role="tab">` (those switch tab panels). Both reuse this one helper so the six
 * destinations are visually uniform (DR-057 — one source for the pill look). Tokens only.
 */

import type React from "react";

/** The `.tab` pill visual for a real nav link. Active = accent-bg/accent-text (prototype `.tab.on`). */
export function navTabStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "7px 13px",
    borderRadius: "8px",
    fontSize: "13px",
    border: "1px solid transparent",
    fontFamily: "var(--font-display)",
    fontWeight: 500,
    textDecoration: "none",
    whiteSpace: "nowrap",
    color: active ? "var(--color-accent-text)" : "var(--color-text2)",
    background: active ? "var(--color-accent-bg)" : "transparent",
    transition:
      "color var(--duration-fast, 150ms) var(--easing-standard, ease), " +
      "background var(--duration-fast, 150ms) var(--easing-standard, ease)",
  };
}

/** Exact active-match for a destination: `/` is exact; the other five match their own path. */
export function isNavActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href;
}
