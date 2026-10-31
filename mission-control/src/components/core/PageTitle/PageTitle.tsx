import type React from "react";
import { PageHead } from "@/components/core/PageHead/PageHead";

export interface PageTitleProps {
  /** Tabler icon class (e.g. "ti-home"). Rendered decorative (aria-hidden). */
  icon: string;
  /** Page title — rendered as H1 and equals the nav/menu label. */
  title: string;
  /** Optional subtitle — shown below the title row, indented to align with title. */
  subtitle?: string;
  /** Optional tail slot — rendered inline after the H1 (count pill, status chip…). */
  tail?: React.ReactNode;
}

/** Compatibility title wrapper over the canonical PageHead; the icon prop remains accepted. */
export function PageTitle({ title, subtitle, tail }: PageTitleProps): React.JSX.Element {
  return (
    <div data-testid="page-title">
      <div data-testid={subtitle ? "page-title-subtitle" : undefined}>
        <PageHead
          title={title}
          subtitle={subtitle}
          actions={tail != null ? <span data-testid="page-title-tail">{tail}</span> : undefined}
        />
      </div>
    </div>
  );
}
