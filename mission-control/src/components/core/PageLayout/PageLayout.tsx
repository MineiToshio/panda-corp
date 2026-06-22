/**
 * PageLayout — THE standard page chrome (DR-062 extension, 2026-06-22).
 *
 * Every top-level surface wraps its body in this one component so the page title
 * block (icon + name + description) lands in the SAME place with the SAME spacing
 * everywhere — no bespoke per-screen `<main>`/PageTitle markup. The persistent
 * header lives in `AppShell` (one level up); this owns the page's single `<main>`,
 * the `PageTitle`, and the title→body rhythm.
 *
 * Reuses the existing `PageTitle` primitive (src/components/core/PageTitle/PageTitle.tsx).
 *
 * Why a wrapper (not the root shell): the page title varies per surface in ways the
 * root shell can't own cleanly — dynamic count tails (Propuestas/Logros) and the
 * Board's conditional title (Tablero vs an open card). A wrapper each page invokes
 * keeps those local while still enforcing one consistent chrome.
 *
 * Server-component safe (no "use client"): purely presentational. Client pages
 * (e.g. BoardShell) can render it too.
 */

import type React from "react";
import { PageTitle } from "@/components/core/PageTitle/PageTitle";

export interface PageLayoutProps {
  /** Tabler icon class for the title block (e.g. "ti-home"). */
  icon: string;
  /** Page title — the H1, equals the nav label. */
  title: string;
  /** Optional description under the title. */
  subtitle?: string;
  /** Optional title-row tail (count pill / status chip). */
  tail?: React.ReactNode;
  /** data-testid for the `<main>` (keeps per-page test hooks, e.g. "dashboard-page"). */
  testId?: string;
  /** Optional accessible label for the `<main>` landmark. */
  ariaLabel?: string;
  /** The page body. Owns its own internal layout (grid, stack, two-pane, …). */
  children: React.ReactNode;
}

/**
 * PageLayout — standardized `<main>` + PageTitle + body.
 *
 * Usage:
 *   <PageLayout icon="ti-home" title="Inicio" subtitle="…" testId="dashboard-page">
 *     {body}
 *   </PageLayout>
 *
 * The title→body gap is the PageTitle's own `marginBottom`, uniform across pages.
 */
export function PageLayout({
  icon,
  title,
  subtitle,
  tail,
  testId,
  ariaLabel,
  children,
}: PageLayoutProps): React.JSX.Element {
  return (
    <main data-testid={testId} aria-label={ariaLabel}>
      <PageTitle icon={icon} title={title} subtitle={subtitle} tail={tail} />
      {children}
    </main>
  );
}
