---
id: WO-08-002
type: work-order
slug: manual-shell
title: 'WO-08-002 — Manual page shell: side menu (Diátaxis) + reader'
status: DRAFT
parent: FRD-08
implementation_status: IN_REVIEW
source_requirements: []
last_updated: '2026-06-17'
---
# WO-08-002 — Manual page shell: side menu (Diátaxis) + reader

Source-of-truth: `FRD > FDD > design-tokens > blueprint > work order`.
Blueprint: [`CMP-08-manual-page`, `CMP-08-doc-nav`, `CMP-08-doc-reader`](../blueprint.md#5-components--interfaces).

## Goal
Build `app/manual/page.tsx` (Server Component): a side menu of pages grouped by Diátaxis quadrant
(Empezar aquí · Guías · Referencia · Conceptos) and a reading area that renders the selected page.
Architecture §11 surface `app/manual`.

## Acceptance criteria (EARS, from FRD-08)
- **AC-08-002.1** — The Manual SHALL offer a side menu with pages and a reading area that renders each page.
- **AC-08-002.2** — The side menu SHALL group pages by the four Diátaxis quadrants (Empezar aquí / Guías / Referencia / Conceptos), built from `readManualPages()` plus the four Reference catalog entries.
- **AC-08-002.3** — Selecting a page SHALL render it in the reading area (authored markdown via `react-markdown`, or a Reference catalog view).
- **AC-08-002.4** — The shell SHALL use FRD-13 tokens (rationed accent on the active page), Spanish labels/`aria-label`s, keyboard navigation and a visible focus ring (FRD-13 a11y).

## Dependencies
- WO-08-001 (`readManualPages()`). Intra-feature.
- FRD-13 tokens, `react-markdown` (architecture §2). Cross-feature.

## TDD plan
1. RED: `app/manual/page.test.tsx` — side menu with 4 groups, select→render, a11y (roles/labels), tokens.
2. GREEN: implement shell + nav + reader.
3. Refactor: share a `SideMenu` primitive if it overlaps with FRD-04/07.

## Definition of done
- Component tests green; tsc + biome clean; tokens only; Spanish labels. `.pandacorp/verify.sh` passes.

## Status Note

**Built:** Manual page shell at `app/manual/` — Server Component `page.tsx` + Client Components `ManualShell`, `DocNav`, `DocReader`. Shared types in `types.ts`.

**Files delivered:**
- `app/manual/types.ts` — `ActivePage`, `AuthoredPageSelection`, `ReferencePageSelection`, `ReaderActivePage`, `ReaderAuthoredPage`, `ReaderReferencePage`, `ManualPageRef` (re-export of `ManualPage`).
- `app/manual/DocNav.tsx` — `DocNav` (CMP-08-doc-nav): side menu `<nav>` with four Diátaxis groups. Always renders all four groups (Empezar aquí / Guías / Referencia / Conceptos). Authored pages grouped from `readManualPages()` props; Reference group has four fixed catalog entries (commands/agents/rules/standards). Active item uses `data-active="true"` + rationed accent via CSS vars. `aria-label` in Spanish. All items are `<button type="button">` (keyboard-navigable). Zero hardcoded colors.
- `app/manual/DocReader.tsx` — `DocReader` (CMP-08-doc-reader): reading area `<main>`. Empty state when `activePage=null`. Renders authored pages via `react-markdown`. Renders four Reference catalog views (CMP-08-reference-commands/agents/rules/standards) derived from canonical readers — no hand-copied lists (DR-046). Zero hardcoded colors.
- `app/manual/ManualShell.tsx` — `ManualShell` (CMP-08-manual-page client shell): owns `activePage` state; resolves `ActivePage` key → `ReaderActivePage` by looking up authored pages; wires DocNav + DocReader side-by-side. "use client" boundary.
- `app/manual/page.tsx` — `ManualPage` (CMP-08-manual-page server entry): Server Component; reads `readManualPages()`, `readSkills()`, `readAgents()`, `readDecisionRules()`, `readStandards()` on the server; passes to `ManualShell`. Route: `app/manual`.
- `app/manual/page.test.tsx` — 34 component tests RED→GREEN covering AC-08-002.1..4.

**Interfaces/contracts exposed:**

```tsx
// DocNav — CMP-08-doc-nav
export interface DocNavProps {
  pages: ManualPageRef[];   // from readManualPages()
  skills: SkillRef[];
  agents: AgentRef[];
  rules: DecisionRule[];
  standards: Standard[];
  activePage: ActivePage | null;
  onSelect: (page: ActivePage) => void;
}
export function DocNav(props: DocNavProps): React.JSX.Element
// data-testid="doc-nav" — <nav aria-label="Menú del Manual">
// data-testid="doc-nav-group-{tutorial|guides|concepts|reference}" — group div
// data-testid="doc-nav-item-{group}-{slug}" — authored page button (data-active)
// data-testid="doc-nav-item-reference-{commands|agents|rules|standards}" — ref button

// DocReader — CMP-08-doc-reader
export interface DocReaderProps {
  activePage: ReaderActivePage | null;
  skills: SkillRef[];
  agents: AgentRef[];
  rules: DecisionRule[];
  standards: Standard[];
}
export function DocReader(props: DocReaderProps): React.JSX.Element
// data-testid="doc-reader" — <main aria-label="Área de lectura del Manual">
// data-testid="doc-reader-empty" — empty state
// data-testid="doc-reader-authored" — authored page article
// data-testid="doc-reader-reference" — reference catalog article
// data-testid="reference-commands-view" / "reference-agents-view" / "reference-rules-view" / "reference-standards-view"
// data-testid="reference-command-{slug}" / "reference-agent-{id}" / "reference-rule-{id}" / "reference-standard-{id}"

// ManualShell — "use client" boundary
export interface ManualShellProps { pages, skills, agents, rules, standards }
export function ManualShell(props: ManualShellProps): React.JSX.Element
// data-testid="manual-shell"

// ActivePage discriminated union (types.ts)
export type ActivePage =
  | { type: "authored"; group: string; slug: string }
  | { type: "reference"; catalog: "commands" | "agents" | "rules" | "standards" }

// ReaderActivePage discriminated union (types.ts)
export type ReaderActivePage =
  | { type: "authored"; page: ManualPage }
  | { type: "reference"; catalog: "commands" | "agents" | "rules" | "standards" }
```

**Integration seams:**
- `app/manual/page.tsx` is the Next.js route at `/manual` (architecture §11).
- `ManualShell` is the "use client" boundary; all filesystem reads stay in `page.tsx`.
- DocNav calls `onSelect(ActivePage)` → ManualShell resolves to `ReaderActivePage` → DocReader renders.
- Reference catalogs reuse `readSkills()`, `readAgents()`, `readDecisionRules()`, `readStandards()` from FRD-07 readers (DR-046, no duplication).

**Test file:** `app/manual/page.test.tsx` (34 tests, AC-08-002.1..4).

**Gate:** 169 test files, 4613 tests GREEN. tsc clean. biome clean. verify.sh PASS.
</content>
