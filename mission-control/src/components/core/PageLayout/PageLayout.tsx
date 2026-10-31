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
  /** data-testid for the page section (keeps per-page test hooks, e.g. "dashboard-page"). */
  testId?: string;
  /** Optional accessible label for the page section landmark. */
  ariaLabel?: string;
  /** The page body. Owns its own internal layout (grid, stack, two-pane, …). */
  children: React.ReactNode;
}

/** Compatibility page frame; the persistent shell owns the single main landmark. */
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
    <section data-testid={testId} aria-label={ariaLabel}>
      <PageTitle icon={icon} title={title} subtitle={subtitle} tail={tail} />
      {children}
    </section>
  );
}
