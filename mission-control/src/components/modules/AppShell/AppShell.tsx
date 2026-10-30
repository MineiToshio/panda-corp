/**
 * AppShell — the persistent global app shell (CMP-19-app-shell, FRD-19).
 *
 * The prototype `topbar()`: one rpgpanel with the brand + guild identity on the left and the seven
 * top-level destinations on the right. Mounted once by `app/layout.tsx`, it frames every top-level
 * surface and is the navigation the per-FRD sharding (DR-056) left orphaned.
 *
 * Client Component: owns the mobile drawer state and reads `usePathname()` to reset navigation
 * after route changes. Every route, including project and configuration descendants, retains
 * the shell and its seven destinations.
 *
 * The brand + guild block (`levelBar`) and the Propuestas destination (`proposalsBadge`) are passed
 * as slot nodes from the Server layout so they keep their server-derived data; `Nav` is the only
 * new client child that needs the pathname.
 *
 * Accessibility: skip link first (WCAG 2.4.1) → `#main-content`; `<header role="banner">` +
 * `<nav>` landmarks; the toggle is a real button with `aria-expanded`/`aria-controls`; each page
 * keeps its own single `<main>` inside `#main-content` (the shell never adds a second `main`).
 *
 * Traceability: CMP-19-app-shell → REQ-19-001/003/004.
 */

"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import type React from "react";
import { ShellNavigation } from "./ShellNavigation";
import styles from "./shell.module.css";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (tokens); responsive bits live in globals.css
// ---------------------------------------------------------------------------

/**
 * The single page column — the prototype's `#pcapp` (centered 1240px maximum with consistent page gutters).
 * It wraps topbar and page content at the same available width; prose limits belong to text blocks.
 */
/** The rpgpanel topbar surface — the embossed pixel tile + dot grid (matches GuildBar / Panel). */
const TOPBAR_STYLE: React.CSSProperties = {
  position: "relative",
  background: "var(--color-card)",
  border: "1px solid var(--color-border-strong)",
  borderRadius: "10px",
  boxShadow:
    "inset 0 1px 0 rgba(255,255,255,.05), inset 0 -2px 0 rgba(0,0,0,.22), 0 2px 0 var(--color-base)",
  backgroundImage:
    "linear-gradient(var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
  padding: "11px 15px",
  marginBottom: "16px",
};

const BRAND_STYLE: React.CSSProperties = {
  display: "flex",
  minWidth: 0,
};

const LOGO_STYLE: React.CSSProperties = {
  borderRadius: "10px",
  border: "1px solid var(--color-border-strong)",
  boxShadow: "0 0 16px -8px var(--color-accent)",
  objectFit: "cover",
  flex: "0 0 auto",
};

const BRAND_TITLE_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-display)",
  fontWeight: 600,
  color: "var(--color-text)",
};

/** Toggle: non-`display` props inline; `display` (hidden on desktop / shown on mobile) is in globals.css. */
export interface AppShellProps {
  /** Brand/guild identity block — a server-rendered `<GuildBar embedded outcomes=… />`. */
  levelBar: React.ReactNode;
  /** The Propuestas destination — `<ProposalsBadge openCount=… />` (placed inside Nav). */
  proposalsBadge: React.ReactNode;
  /** Global pending-merge indicator (FRD-21) — a server-rendered `<PendingMergeBadge>`, placed in the
   * topbar OUTSIDE the nav destination row. Optional: it renders nothing when there is no un-merged work. */
  pendingMergeBadge?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * AppShell — persistent topbar + page content.
 *
 * Every surface keeps the skip link, global header and `#main-content` wrapper.
 */
export function AppShell({
  levelBar,
  proposalsBadge,
  pendingMergeBadge,
  children,
}: AppShellProps): React.JSX.Element {
  const pathname = usePathname() ?? "";

  return (
    <>
      <a href="#main-content" className="app-skip-link">
        Saltar al contenido
      </a>

      <div className={styles.container}>
        {/* <header> not inside a sectioning element → implicit ARIA role "banner" (no explicit role). */}
        <header
          data-app-shell
          data-testid="app-shell"
          className={styles.header}
          style={TOPBAR_STYLE}
        >
          {/* Left — brand + guild identity (level/XP) */}
          <div className={styles.brand} style={BRAND_STYLE}>
            <Image
              src="/brand/pandacorp.png"
              alt="Pandacorp"
              width={44}
              height={44}
              priority
              style={LOGO_STYLE}
              className={styles.logo}
            />
            <div style={{ minWidth: 0 }}>
              <div className={styles.brandTitle} style={BRAND_TITLE_STYLE}>
                Pandacorp Mission Control
              </div>
              <div style={{ marginTop: "4px" }}>{levelBar}</div>
            </div>
          </div>

          <ShellNavigation
            key={pathname}
            proposalsBadge={proposalsBadge}
            pendingMergeBadge={pendingMergeBadge}
          />
        </header>

        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </>
  );
}
