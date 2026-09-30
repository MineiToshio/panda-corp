"use client";
/**
 * manual/_components/ManualLink.tsx — FRD-08 in-Manual cross-link
 *
 * An inline text button that jumps to another authored Manual page through the
 * shell's nav context (`goToManual`). A real <button> (keyboard-operable), styled
 * as a link with tokens only.
 *
 * Traceability: CMP-08-readers (cross-navigation).
 */

import type React from "react";
import { useManualNav } from "../ManualNavContext";

export interface ManualLinkProps {
  /** Diátaxis group of the target page (e.g. "concepts"). */
  group: string;
  /** Slug of the target page (e.g. "espinazo-de-documentos"). */
  slug: string;
  children: React.ReactNode;
}

/** Inline button-as-link to another Manual page. */
export function ManualLink({ group, slug, children }: ManualLinkProps): React.JSX.Element {
  const nav = useManualNav();
  const handleClick = (): void => nav.goToManual(group, slug);
  return (
    <button
      type="button"
      onClick={handleClick}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        margin: 0,
        font: "inherit",
        color: "var(--color-accent-text)",
        textDecoration: "underline",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
