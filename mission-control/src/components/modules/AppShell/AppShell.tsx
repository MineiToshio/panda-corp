/**
 * AppShell — the persistent global app shell (CMP-19-app-shell, FRD-19).
 *
 * The prototype `topbar()`: one rpgpanel with the brand + guild identity on the left and the six
 * top-level destinations on the right. Mounted once by `app/layout.tsx`, it frames every top-level
 * surface and is the navigation the per-FRD sharding (DR-056) left orphaned.
 *
 * Client Component: owns the mobile drawer state and reads `usePathname()` to decide scope — the
 * drill-in surfaces (`/projects/**`, `/configuration`) render WITHOUT the topbar (they carry their
 * own in-context header + back control), mirroring `e2e/shell.ts` SHELL_EXEMPT (AC-19-004).
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
import { useState } from "react";
import { Nav } from "@/components/modules/Nav/Nav";
import { isShellExempt } from "./shellScope";

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only (tokens); responsive bits live in globals.css
// ---------------------------------------------------------------------------

/**
 * The single page column — the prototype's `#pcapp` (max-width 1240px, centered, padding 24/20/60).
 * It wraps the topbar AND the page content so both share one width; no per-page max-width drift.
 */
const APP_CONTAINER_STYLE: React.CSSProperties = {
  maxWidth: "1240px",
  margin: "0 auto",
  padding: "24px 20px 60px",
};

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
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  flexWrap: "wrap",
  padding: "11px 15px",
  marginBottom: "16px",
};

const BRAND_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
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
  fontSize: "17px",
  lineHeight: 1.05,
  fontWeight: 600,
  color: "var(--color-text)",
};

const RIGHT_GROUP_STYLE: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

/** Toggle: non-`display` props inline; `display` (hidden on desktop / shown on mobile) is in globals.css. */
const TOGGLE_STYLE: React.CSSProperties = {
  alignItems: "center",
  justifyContent: "center",
  padding: "7px 9px",
  borderRadius: "8px",
  border: "1px solid var(--color-border-strong)",
  background: "var(--color-panel)",
  color: "var(--color-text)",
  cursor: "pointer",
};

export interface AppShellProps {
  /** Brand/guild identity block — a server-rendered `<GuildBar embedded outcomes=… />`. */
  levelBar: React.ReactNode;
  /** The Propuestas destination — `<ProposalsBadge openCount=… />` (placed inside Nav). */
  proposalsBadge: React.ReactNode;
  children: React.ReactNode;
}

/**
 * AppShell — persistent topbar + page content.
 *
 * On a top-level surface: skip link → `<header data-app-shell>` (brand + level on the left, the
 * toggle + `Nav` on the right) → `#main-content` wrapping the page. On an exempt drill-in: just
 * `#main-content` (no topbar).
 */
export function AppShell({ levelBar, proposalsBadge, children }: AppShellProps): React.JSX.Element {
  const pathname = usePathname() ?? "";
  const [navOpen, setNavOpen] = useState(false);
  const exempt = isShellExempt(pathname);

  const handleToggle = (): void => {
    setNavOpen((open) => !open);
  };

  if (exempt) {
    return (
      <div style={APP_CONTAINER_STYLE}>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <>
      <a href="#main-content" className="app-skip-link">
        Saltar al contenido
      </a>

      <div style={APP_CONTAINER_STYLE}>
        {/* <header> not inside a sectioning element → implicit ARIA role "banner" (no explicit role). */}
        <header data-app-shell data-testid="app-shell" style={TOPBAR_STYLE}>
          {/* Left — brand + guild identity (level/XP) */}
          <div style={BRAND_STYLE}>
            <Image
              src="/brand/pandacorp.png"
              alt="Pandacorp"
              width={44}
              height={44}
              priority
              style={LOGO_STYLE}
            />
            <div style={{ minWidth: 0 }}>
              <div style={BRAND_TITLE_STYLE}>Pandacorp Mission Control</div>
              <div style={{ marginTop: "4px" }}>{levelBar}</div>
            </div>
          </div>

          {/* Right — mobile toggle + the six destinations */}
          <div style={RIGHT_GROUP_STYLE}>
            <button
              type="button"
              data-nav-toggle
              data-testid="app-nav-toggle"
              aria-expanded={navOpen}
              aria-controls="app-nav-region"
              aria-label={navOpen ? "Cerrar menú de navegación" : "Abrir menú de navegación"}
              onClick={handleToggle}
              style={TOGGLE_STYLE}
            >
              <i className="ti ti-menu-2" aria-hidden="true" style={{ fontSize: "20px" }} />
            </button>

            {/* display is owned by globals.css (desktop inline / mobile drawer via [data-open]) —
                NOT inline, so the responsive media query is not overridden by inline specificity. */}
            <div id="app-nav-region" data-nav-region data-open={navOpen ? "true" : "false"}>
              <Nav proposalsBadge={proposalsBadge} />
            </div>
          </div>
        </header>

        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </>
  );
}
