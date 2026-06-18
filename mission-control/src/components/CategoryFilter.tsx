/**
 * CategoryFilter — project_type filter chips (CMP-02-category-filter).
 *
 * "use client" — interactive; uses click events.
 *
 * Traceability:
 *   CMP-02-category-filter → components/CategoryFilter.tsx
 *   AC-02-006.1 — The board SHALL allow filtering by category (project_type).
 *   REQ-02-006  — chips/select of distinct project_type values; "All" resets.
 *
 * Contract (docs/api.md WO-02-008):
 *   - data-testid="category-filter" on the root element.
 *   - data-testid="category-filter-all" on the "Todas" / reset chip.
 *   - data-testid="category-filter-option" on each category chip.
 *   - Selecting a category calls onSelect(category).
 *   - Selecting "All" calls onSelect(null).
 *   - The active chip has aria-pressed="true"; others have aria-pressed="false".
 *   - Duplicate categories in the input are deduplicated.
 *   - An unknown selected value (not in categories) leaves all category chips inactive.
 *
 * Design rules:
 *   - Zero hardcoded colors — all visual values via CSS custom properties.
 *   - Spanish UI copy (AGENTS.md: single operator, Spanish UI).
 *   - Keyboard accessible: each chip is a <button> element.
 */

"use client";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CategoryFilterProps {
  /** List of distinct project_type values to display as chips. Will be deduplicated. */
  categories: string[];
  /** Currently selected category, or null when "All" is active. */
  selected: string | null;
  /** Callback invoked when the user selects a category (string) or resets (null). */
  onSelect: (category: string | null) => void;
}

// ---------------------------------------------------------------------------
// Styles — CSS custom properties only; no hardcoded color values.
// ---------------------------------------------------------------------------

const CONTAINER_STYLE: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "calc(var(--space-base, 1rem) * 0.375)",
  alignItems: "center",
  // Reset <fieldset> browser defaults (border, padding, min-width).
  border: "none",
  padding: 0,
  margin: 0,
  minWidth: 0,
};

// Visually hidden but readable by assistive technology (for <fieldset> label).
const VISUALLY_HIDDEN_STYLE: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
  border: 0,
};

const baseChipStyle = (active: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "0.125rem 0.625rem",
  borderRadius: "calc(var(--radius, 0.5rem) * 2)",
  fontSize: "0.75rem",
  fontWeight: active ? 700 : 500,
  cursor: "pointer",
  border: `var(--hairline, 1px) solid ${active ? "var(--color-accent, currentColor)" : "var(--color-border, currentColor)"}`,
  background: active
    ? "var(--color-accent, currentColor)"
    : "var(--color-chip-bg, var(--color-surface, transparent))",
  color: active ? "var(--color-on-accent, Canvas)" : "var(--color-chip-text, currentColor)",
  transition:
    "background var(--duration-fast, 150ms) var(--easing-standard, ease), color var(--duration-fast, 150ms) var(--easing-standard, ease)",
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * CategoryFilter — presents a "Todas" chip + one chip per deduplicated category.
 * Controlled: the parent drives `selected` and handles `onSelect`.
 * Server-safe rendering: no browser APIs, only click handlers (safe with "use client").
 */
export function CategoryFilter({
  categories,
  selected,
  onSelect,
}: CategoryFilterProps): React.JSX.Element {
  // Deduplicate while preserving insertion order.
  const unique = Array.from(new Set(categories));

  // An unknown selected value (not in the list) is treated as no active category chip.
  const activeCategory = unique.includes(selected ?? "") ? selected : null;
  const allActive = activeCategory === null;

  return (
    <fieldset data-testid="category-filter" style={CONTAINER_STYLE}>
      {/* Visually hidden <legend> satisfies the <fieldset> semantic requirement. */}
      <legend style={VISUALLY_HIDDEN_STYLE}>Filtrar por categoría</legend>

      {/* "Todas" / reset chip */}
      <button
        type="button"
        data-testid="category-filter-all"
        style={baseChipStyle(allActive)}
        aria-pressed={allActive}
        onClick={() => onSelect(null)}
      >
        Todas
      </button>

      {/* One chip per deduplicated category */}
      {unique.map((cat) => {
        const isActive = cat === activeCategory;
        return (
          <button
            key={cat}
            type="button"
            data-testid="category-filter-option"
            style={baseChipStyle(isActive)}
            aria-pressed={isActive}
            onClick={() => onSelect(cat)}
          >
            {cat}
          </button>
        );
      })}
    </fieldset>
  );
}
