---
id: FRD-13-blueprint
type: blueprint
parent: FRD-13
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-18'
---
# FRD-13 — Visual system and accessibility — feature blueprint

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> FRD-13 is **cross-cutting and mostly declarative**: it has little runtime logic and instead
> defines the **token system** and the **rules** by which every other feature consumes it. Built on
> the platform architecture (`../../product/architecture.md` §7 "Accessibility & visual system",
> §2 Tailwind v4 `@theme`/OKLCH). The **design tokens are above this blueprint** in the hierarchy:
> the frozen `docs/design/design-tokens.json` + `DESIGN.md` (produced by the `/pandacorp:design`
> phase, see `docs/design/brief.md`) are the source of truth for *values*; this blueprint defines
> *how they are wired and enforced*, not the palette.

## 0. Requirement IDs (assigned here)

| ID | Requirement (EARS, abridged) |
|---|---|
| REQ-13-001 | Theme derived from few tokens in perceptual space (OKLCH: base, accent, contrast); a high-contrast mode without redesign. |
| REQ-13-002 | A single rationed accent (punctuation, not paint): accent only on what matters; rest warm neutrals. |
| REQ-13-003 | EVERY number uses `font-variant-numeric: tabular-nums`. |
| REQ-13-004 | Elevation has 3 levels (canvas → panel → card/popup) with tokenized shadow/spacing scale (radius 8px, base 16px, hairline 1px, spacing in 0.25rem multiples). |
| REQ-13-005 | Animation uses only `transform`+`opacity`, <300ms, frequency test; 2–3 easing tokens. |
| REQ-13-006 | UI honors `prefers-reduced-motion`: disables ALL Party animation. |
| REQ-13-007 | NO state depends on color alone: each state paired with icon/shape + label. |
| REQ-13-008 | Accessibility: Spanish `aria-label` on icons, `aria-live="polite"`, visible focus ring respecting border-radius, keyboard list nav, contrast ≥4.5:1. |

## 1. Architecture fit

There is almost no JS logic here — the deliverable is a **token contract** + **CSS wiring** +
**enforced conventions**, consumed by FRD-02..06, FRD-10, etc.

Layers:
1. **`docs/design/design-tokens.json`** (frozen by the design phase) — OKLCH base/accent/contrast,
   light/dark/high-contrast, the ~10 **per-agent colors**, elevation/spacing/radius scale, motion
   (durations + 2–3 easings). Source of truth for *values*. **This blueprint does not set values.**
2. **`app/globals.css`** (Tailwind v4 `@theme`) — maps the JSON tokens to CSS custom properties /
   theme variables; sets `color-scheme`, base `tabular-nums`, the 3 elevation levels, the focus
   ring, the motion tokens, and the `@media (prefers-reduced-motion: reduce)` block.
3. **A thin TS helper** (`lib/theme` is NOT created — this is a feature-level constant) exposing the
   **agent-color token keys** so `IF-06-agent-color` and DAG nodes read one canonical key map.
4. **Conventions** in `DESIGN.md` (allowed components, prohibitions: no hardcoded colors, single
   primary action per screen) — enforced by review + biome where possible.

## 2. Components (`CMP-13-*`) and interfaces (`IF-13-*`)

| ID | Kind | Name | Responsibility | Traces |
|---|---|---|---|---|
| IF-13-tokens | contract | `design-tokens.json` schema | OKLCH base/accent/contrast, themes (light/dark/high-contrast), agent palette, elevation/spacing/radius, motion. Frozen by the design phase; this WO validates its shape. | REQ-13-001, REQ-13-004, REQ-13-005 |
| IF-13-theme-vars | contract | `@theme` CSS variables in `globals.css` | The CSS surface every component styles against. | REQ-13-001..005 |
| IF-13-agent-colors | interface | `AGENT_COLOR: Record<Role, tokenVar>` | Canonical role→color-token-key map (the single source for sprite, feed, cards, DAG). Consumed by FRD-06 `IF-06-agent-color` + FRD-12 DAG. | REQ-13-002 (agent colors) |
| IF-13-state-vocab | interface | `STATE_BADGE: Record<State, {icon, label}>` | The icon+label pairing for each state (working/idle/failed/completed/blocked/reviewing) so no state is color-only. | REQ-13-007 |
| CMP-13-globals | CSS | `app/globals.css` | Wires tokens → theme vars; `color-scheme`, `tabular-nums`, 3 elevations, focus ring, motion + reduced-motion. | REQ-13-001..006, REQ-13-008 |
| CMP-13-theme-toggle | client | `ThemeToggle` | Light/dark/high-contrast toggle; respects `prefers-color-scheme`; persists in `localStorage` (architecture §4.8). | REQ-13-001 |
| CMP-13-state-badge | shared | `StateBadge` | Renders a state as icon+shape+label (never color-only); Spanish `aria-label`. Reused by Party/feed/DAG. | REQ-13-007, REQ-13-008 |
| CMP-13-a11y-primitives | shared | focus ring + `aria-live` region + numeric utility | The visible focus ring (respects radius), the polite live region wrapper, the `tabular-nums` utility class. | REQ-13-003, REQ-13-008 |

### New `lib/` modules
None. The agent-color key map and the state-vocab are feature-level constants
(`app/_design/tokens.ts` or `lib/constants.ts` per AGENTS.md "no magic strings"), not a data-layer
reader. (`lib/theme` is intentionally NOT introduced.)

## 3. Contracts
- **No hardcoded colors anywhere** (AGENTS.md, project rule 4): every styled value reads a token
  var. This blueprint's `globals.css` is the only place that touches raw token values.
- **Token JSON shape** (validated in WO-13-001) — minimal required keys: `oklch.base/accent/contrast`,
  `themes.{light,dark,highContrast}`, `agents.<role>`, `elevation[0..2]`, `radius/spacing/hairline`,
  `motion.duration.*` (<300ms), `motion.easing.*` (2–3).
- **Reduced-motion contract:** `@media (prefers-reduced-motion: reduce)` zeroes motion durations and
  the Party engine reads it to skip the RAF loop (FRD-06 WO-06-011). FRD-13 owns the CSS side.
- **State-by-icon contract:** consumers render `StateBadge` (or `STATE_BADGE`) — they MUST NOT
  signal state by color alone (review-enforced).

## 4. App surface (§11)
`app/globals.css` (the token wiring) + `docs/design/` (the frozen tokens). `ThemeToggle` in the
global header. `StateBadge` + a11y primitives in `components/` (shared, reused across features).

## 5. Cross-feature dependencies
- **Design phase (`docs/design/design-tokens.json` + `DESIGN.md`)** — must be **frozen first**;
  these are *above* this blueprint in the hierarchy. WO-13-001 validates/consumes them. **Blocking
  precondition for the value-bearing WOs.**
- **Consumed by FRD-02..06, FRD-10, FRD-12** — the agent colors, tabular-nums, motion, reduced-motion,
  state badges and focus ring are dependencies of every UI WO in those features. FRD-13's wiring WOs
  (13-001/002/003) should land early so the other features' UI WOs can build against real tokens.

## 6. Traceability (REQ → CMP/IF)
Every REQ-13-MMM maps to a CMP-13-* / IF-13-* in §2. The requirements are largely declarative
(tokens + CSS + conventions); the few interactive pieces (`ThemeToggle`, `StateBadge`) are testable.
No requirement is unbuildable.

## 7. Open dependency note (flag)
`design-tokens.json` and `DESIGN.md` **do not yet exist** in the repo (only `docs/design/brief.md`
+ `references`/`codex` scaffolding). The design phase must freeze them before the value-bearing
WOs (13-001 validation gains teeth, 13-002 wiring) can complete. The logic-only pieces (the
`STATE_BADGE` vocabulary, the `AGENT_COLOR` *key* map, the schema validator) can be built against
the agreed *shape* now; the *values* land when the tokens are frozen. This is sequencing, not an
unbuildable requirement.
