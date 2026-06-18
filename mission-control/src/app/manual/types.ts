/**
 * app/manual/types.ts — WO-08-002 (FRD-08)
 *
 * Shared types for the Manual page shell: DocNav + DocReader.
 * Kept in a single file to avoid circular imports between components.
 *
 * Traceability: CMP-08-manual-page, CMP-08-doc-nav, CMP-08-doc-reader (blueprint §5)
 */

import type { ManualPage } from "@/lib/manual";

// Re-export ManualPage as ManualPageRef for use in DocNav/DocReader
// (avoids direct dep on lib/ in client component props that go through RSC)
export type { ManualPage as ManualPageRef };

// ---------------------------------------------------------------------------
// ActivePage — discriminated union of what the reader is showing
// ---------------------------------------------------------------------------

/** An authored Tutorial / Guides / Concepts page selected from the nav. */
export type AuthoredPageSelection = {
  type: "authored";
  /** Diátaxis group (matches ManualPage.group). */
  group: string;
  /** Page slug (matches ManualPage.slug). */
  slug: string;
};

/** A Reference catalog entry selected from the nav. */
export type ReferencePageSelection = {
  type: "reference";
  catalog: "commands" | "agents" | "rules" | "standards";
};

/** The union — what is currently selected in the Manual. */
export type ActivePage = AuthoredPageSelection | ReferencePageSelection;

// ---------------------------------------------------------------------------
// DocReaderActivePage — the resolved shape passed to DocReader
// (distinct from ActivePage which only carries the selection key)
// ---------------------------------------------------------------------------

/** An authored page fully resolved (includes the ManualPage body for rendering). */
export type ReaderAuthoredPage = {
  type: "authored";
  page: ManualPage;
};

/** A reference catalog selection (data comes via separate props). */
export type ReaderReferencePage = {
  type: "reference";
  catalog: "commands" | "agents" | "rules" | "standards";
};

/** The resolved active page passed to DocReader. */
export type ReaderActivePage = ReaderAuthoredPage | ReaderReferencePage;
