/**
 * Nav — the persistent top-level destinations of the app shell (CMP-19-nav, FRD-19).
 *
 * The prototype `topbar()` nav row: six `.tab` destinations, active by current route. Five are plain
 * `next/link`s here; the sixth (Propuestas) is the `ProposalsBadge` slot, placed in its prototype
 * position (4th) so the row reads Inicio · Tablero · Portfolio · Propuestas · Logros · Documentación.
 * Real links (not `<button role="tab">`) styled as the `.tab` pill (shared `navTabStyle`).
 *
 * Traceability: CMP-19-nav → REQ-19-001 (AC-19-001.1/.2/.4), REQ-19-002 (AC-19-002.1/.2).
 */

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { isNavActive, navTabStyle } from "./navTab";

interface NavItem {
  readonly slug: string;
  readonly label: string;
  readonly href: string;
}

/** The three destinations before Propuestas (prototype order). */
const LINKS_BEFORE: readonly NavItem[] = [
  { slug: "inicio", label: "Inicio", href: "/" },
  { slug: "tablero", label: "Tablero", href: "/board" },
  { slug: "portfolio", label: "Portfolio", href: "/portfolio" },
] as const;

/** The two destinations after Propuestas (prototype order). */
const LINKS_AFTER: readonly NavItem[] = [
  { slug: "logros", label: "Logros", href: "/achievements" },
  { slug: "documentacion", label: "Documentación", href: "/manual" },
] as const;

const NAV_STYLE: React.CSSProperties = {
  display: "flex",
  gap: "5px",
  flexWrap: "wrap",
  alignItems: "center",
};

/** One top-level destination as a `.tab` link, active-aware. Module scope (not nested). */
function NavLink({ item, pathname }: { item: NavItem; pathname: string }): React.JSX.Element {
  const active = isNavActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      data-testid={`app-nav-${item.slug}`}
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
      style={navTabStyle(active)}
    >
      {item.label}
    </Link>
  );
}

export interface NavProps {
  /** The Propuestas destination (ProposalsBadge), placed in its prototype position (4th). */
  proposalsBadge: React.ReactNode;
}

/**
 * Nav — the six top-level destinations, active by `usePathname()`.
 *
 * Renders the five plain destinations around the Propuestas slot. Exactly one destination is active
 * at a time; an exempt drill-in or unmatched route leaves none active (no false highlight).
 */
export function Nav({ proposalsBadge }: NavProps): React.JSX.Element {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Navegación principal" data-testid="app-nav" style={NAV_STYLE}>
      {LINKS_BEFORE.map((item) => (
        <NavLink key={item.slug} item={item} pathname={pathname} />
      ))}
      {proposalsBadge}
      {LINKS_AFTER.map((item) => (
        <NavLink key={item.slug} item={item} pathname={pathname} />
      ))}
    </nav>
  );
}
