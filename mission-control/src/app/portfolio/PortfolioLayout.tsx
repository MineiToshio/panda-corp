"use client";

/**
 * PortfolioLayout — the portfolio's rail + workspace grid with a user-controlled,
 * COLLAPSIBLE projects rail (owner request).
 *
 * The portfolio's three nested columns (projects rail · doc nav · document) feel cramped
 * in the Documentos tab. Rather than widen the whole app, the owner collapses the projects
 * rail when they want room — and the choice persists (localStorage) so it survives
 * navigation/reload. Collapsed, the workspace (and the document reader) take the full width.
 *
 * The server-rendered rail + workspace are passed in as props (RSC composition); this client
 * boundary owns ONLY the toggle state. The grid track-template + the hidden-when-collapsed
 * rail body live in globals.css (`.pc-portfolio-grid` / `.is-collapsed`), so the responsive
 * single-column stack on mobile is preserved.
 */

import type { ReactNode } from "react";
import { useEffect, useState } from "react";

/** localStorage key for the owner's rail-collapsed preference. */
const STORAGE_KEY = "pc-portfolio-rail-collapsed";

const GRID_STYLE: React.CSSProperties = {
  display: "grid",
  gap: "14px",
  alignItems: "start",
};

export interface PortfolioLayoutProps {
  /** The projects rail (label + ProjectRail), server-rendered. */
  rail: ReactNode;
  /** The selected project's workspace pane, server-rendered. */
  workspace: ReactNode;
}

export function PortfolioLayout({ rail, workspace }: PortfolioLayoutProps): React.JSX.Element {
  // Default expanded; apply the stored choice AFTER mount so SSR and the first client render
  // agree (no hydration mismatch). A returning owner sees a brief expanded frame, then their
  // collapsed preference — acceptable for an internal tool, and avoids a flash-of-wrong-layout
  // hydration error.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* localStorage unavailable → stay expanded */
    }
  }, []);

  const handleToggle = (): void => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore persistence failures */
      }
      return next;
    });
  };

  return (
    <div
      className={collapsed ? "pc-portfolio-grid is-collapsed" : "pc-portfolio-grid"}
      style={GRID_STYLE}
    >
      <div className="pc-portfolio-railcol">
        <button
          type="button"
          data-testid="portfolio-rail-toggle"
          className="pc-rail-toggle"
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Mostrar la lista de proyectos" : "Ocultar la lista de proyectos"}
          title={collapsed ? "Mostrar proyectos" : "Ocultar proyectos"}
          onClick={handleToggle}
        >
          <i
            className={
              collapsed ? "ti ti-layout-sidebar-left-expand" : "ti ti-layout-sidebar-left-collapse"
            }
            aria-hidden="true"
          />
        </button>
        <div className="pc-rail-body">{rail}</div>
      </div>
      {workspace}
    </div>
  );
}
