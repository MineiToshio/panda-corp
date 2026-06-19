# FDD-13 — Visual system and accessibility (cross-cutting)

> **Cross-cutting, not a screen.** FRD-13 is the **token system + accessibility rules** applied
> everywhere in Mission Control — it has no single view. This FDD describes the frozen visual layer
> and how it is applied; the per-screen FDDs (FRD-14 snapshot, FRD-15 plugin-sync banner, FRD-16
> orphans banner, plus the Party FDDs) all sit **on top of** this contract.

- **Visual source (anchor):** `docs/design/prototype/index.html` — the owner-approved whole-app SPA
  prototype (DR-054 ADOPT-VISUAL). Its `<style>` block (lines ~20–158) is the reference for **how**
  the tokens and a11y rules are applied app-wide; this FDD does not invent values, it points at the
  frozen artifacts below.
- **Frozen contract (source of truth):**
  - `docs/design/design-tokens.json` — the canonical token file (hex, frozen from the prototype).
  - root `DESIGN.md` — tokens + allowed components + prohibitions.
  - `src/app/_design/tokens/tokens.ts` + `src/app/globals.css` — the runtime mirror.
- **Source-of-truth hierarchy (DR-049):** `FRD > FDD > design-tokens > blueprint > work order`.

## What this layer is (the frozen visual system)

The visual system was **extracted faithfully from the prototype**, not invented. It supersedes the
earlier invented cold-blue (hue ~230) OKLCH palette from `docs/design/brief.md`. The committed tokens
are **hex** (warm pixel-RPG / "guild" palette); only the per-agent role-identity palette stays OKLCH
(perceptual spacing keeps roles distinguishable).

### 1. Themes — few tokens, two committed themes
- Exactly **two committed themes**: `dark` (default) + `light`, each a small structured set of
  `surfaces` / `text` / `borders` / `accent` / `status` / `categories` / `tiers` tokens
  (`design-tokens.json` → `themes.dark` / `themes.light`).
- **High-contrast** is a var-override layer over the dark theme (pure black/white extreme inversion),
  NOT a third token theme.
- Touching the accent never throws off text contrast because the themes are structured, not loose
  hex (REQ-13, AC: "few tokens").

### 2. Single rationed accent (punctuation, not paint)
- One accent (`accent.accent` = `#33B6D1` dark / `#007890` light) reserved for **what matters**:
  active tab/nav (`navitem.on`, `tab.active` → `accent-bg` + `accent-text`), the working agent halo,
  the XP-bar fill, focus ring. Everything else is warm neutrals.
- In the prototype `<style>`: `.navitem.on`, `.stab.on`, `.rail.on` carry the accent; bodies/cards stay
  neutral. The banners (FRD-15/16) deliberately use `warn`, not accent — they are alerts, not navigation.

### 3. tabular-nums on every number
- `body { font-variant-numeric: tabular-nums }` is set globally (prototype line 58); `.px` (Pixelify)
  and `.herostat .big` re-assert it. Every count, SHA, level, XP, timestamp aligns. The implemented
  `StatusChips`, `SnapshotPanel` and `StateBadge` all carry `tabular-nums` on their numerals.

### 4. Three elevation levels
- `--shadow-0` (none / canvas) → `--shadow-1` (resting, `shadows.shadow`) → `--shadow-2` (pop,
  `shadows.shadowPop`). The light theme re-declares `--shadow-1/2` softer.
- Radii: `sm 8px · md 12px · lg 16px · pill 999px` (`radii`). The app-wide **RPG embossed skin**
  (`rpgSkin.overrides.panel` / `rpgpanel`) re-skins panels with the `inset 0 1px 0 …, inset 0 -2px 0 …,
  0 2px 0 canvas` "pressed pixel tile" signature — this is part of the contract (complete extraction,
  DR-056) and applies app-wide, so every surface this FDD governs inherits it.

### 5. Motion — frequency test + reduced-motion
- `transform`/`opacity` only, <300ms. Everyday motion (tabs, hover) is sober; **expressive motion is
  reserved for the Party canvas** (sprite bob, halos, emotes) and rare satisfying events (level-up,
  WO completed). 2–3 easing tokens, not per-component curves.
- `@media (prefers-reduced-motion: reduce)` disables `.anim`, `.reveal` transitions and all Party
  animation (prototype lines 142, 151) — long unattended sessions must not fatigue.

### 6. State never by color alone
- Each state (working / idle / failed / completed / blocked / reviewing) is paired with an
  **icon/shape + Spanish label** — critical with a warm palette (reds/oranges/amber are close).
- Realized by the **`StateBadge`** primitive (`src/components/core/StateBadge/StateBadge.tsx`):
  geometrically distinct inline SVG per state + visible label + `aria-label`. The two FRD-15/16
  banners reinforce the same rule (warning triangle icon + heading text, not color alone).

### 7. Canonical agent-role set
- `AGENT_ROLES` / `AGENT_COLOR` (`src/app/_design/tokens/tokens.ts`) is the single source for the real
  engine/pipeline roles (implementer, reviewer, test-writer, backend-dev, frontend-dev, plus the
  per-phase specialists). It does **not** include the fictitious `guild` aggregate. Each role carries a
  fixed OKLCH color token.

### 8. Accessibility rules (applied everywhere)
- Spanish `aria-label` on icons; `aria-live="polite"` to announce events without stealing focus;
  visible focus ring respecting `border-radius` (`:focus-visible { outline: 2px solid var(--accent);
  outline-offset: 2px }`, prototype line 88); keyboard list navigation; **contrast ≥4.5:1** in both
  themes (a real risk with light warms). These ride on the a11y primitives in `src/components/a11y/`.

## States (cross-cutting, not a single screen)
Because this layer is the token/a11y system rather than a view, its "states" are the **theme/contrast
modes** it must hold up under:
- **Default (dark):** the frozen warm pixel-RPG identity.
- **Light:** every token re-declared; contrast re-verified ≥4.5:1.
- **High-contrast:** var-override over dark (pure black/white inversion) — must enable without a
  redesign.
- **Reduced-motion:** all expressive/Party motion disabled; layout unchanged.
- **Empty / loading / error of consuming screens:** governed by each consuming FDD (FRD-14/15/16,
  Party), but they MUST draw their colors/spacing/radii from this contract only — no hardcoded values.

## Components mapped to shared primitives
This layer is consumed by every screen via the frozen primitives — see `docs/design/components.md`.
Most relevant here: `StateBadge` (icon+shape+label state), `ThemeToggle` (light/dark, both
first-class), `XpBar` (rationed accent fill), `CelebrationSurface` (reduced-motion-aware expressive
moment), and the `a11y/` primitives (`LiveRegion`, `useKeyboardNav`).

## Visual reference
`docs/design/prototype/index.html` `<style>` block (the app-wide skin + a11y rules) + the frozen
`docs/design/design-tokens.json` and root `DESIGN.md`. There is no single render function: this is the
cross-cutting token/a11y layer every render function inherits.
