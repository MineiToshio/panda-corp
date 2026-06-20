# FDD-09 — Gamification (RPG theme) — feature design

> **Visual source:** `docs/design/prototype/index.html` (the owner-approved whole-app SPA prototype).
> Frozen tokens: `docs/design/design-tokens.json` (Atelier — pixel-RPG / guild). This FDD scopes the
> gamification layer onto those frozen tokens. **No hardcoded visuals** — every value below maps to a
> token group (`rpgSkin`, `tiers`, `accent`, `typography.families.pixel`).

## Nature of this feature — cross-cutting, not one screen

FRD-09 is **not a single page**. It is the *guild* meta-layer: a set of **shared gamified elements**
(level/XP, the pixel numerals, tier medals, the celebration scale) that appear across many host
surfaces. This FDD therefore describes the **shared elements + where they appear**, not a screen
layout. The screens that *use* these elements are owned by other FRDs (the Achievements Hall by
FRD-10, the Party canvas by FRD-06, the dashboard by FRD-12). FRD-09 owns the *vocabulary* and the
*visual contract* of the gamified primitives.

Guild (gremio) vs Party are kept distinct per the FRD: **Guild** = operator + whole factory
(top bar, Hall, codex, attributes — persistent, cross-cutting); **Party** = the agents on one
project (FRD-06). FRD-09 covers the **Guild** elements only.

## Shared gamified elements (token-mapped) and their host surfaces

### 1. Guild bar — level · title · XP (top of every page)
- **Render fn:** `topbar()` (index.html ~L577). Host: the app shell header, on **every** view.
- **Composition:** `.rpgpanel.rpggrid` container (`rpgSkin.rpgpanel` + `rpgSkin.rpggrid`) → Pandacorp
  logo crest → app title in `typography.families.display` (`.ttl`) → a **level pill** (`NV {n}`) in
  `typography.families.pixel` on `accent` fill → the guild **title** (e.g. "Gran maestro del gremio")
  in `text.t2` → a compact inline **`.xpbar`** (`rpgSkin.xpbar`, 90px wide, 9px tall) to next level.
- The level pill, the XP numerals and "NV" use the **pixel** family — the RPG signature numerals.

### 2. Guild hero panel (the character sheet header) — Achievements Hall + dashboard footer
- **Render fns:** `logrosHero()` (~L407, the full hero), `dashboardView()` foot block (~L665, the
  compact variant).
- **Composition:** `.rpgpanel.rpggrid` → the **`.shield.rpggrid`** crest (`rpgSkin.shield`, 96×96,
  `accent`-bordered glowing medallion) carrying the pixel **NIVEL / {level}** numeral (42px pixel
  font, `accent.accentText`) → "GREMIO PANDACORP" eyebrow → guild title (`.ttl`, 27px display) →
  a feats/trophies/missions summary line → the full-width **`.xpbar`** (18px) with "faltan {n} para
  Nv {n+1} · {nextRank}". Below a hairline: **TU PARTY** sprite roster (agent sprites, 38px,
  `image-rendering: pixelated`) + three **`badge`** mini stat tiles (`rpgpanel`, pixel numeral).

### 3. XP bar primitive (`.xpbar`)
- **Token:** `rpgSkin.xpbar` — 18px tall (compact 9–14px variants per host), `bd2` border on `canvas`
  base, `accent` fill with `transition: width .6s`, plus the `::after` segmented striping
  (16px transparent + 2px canvas notch). Reused by the guild bar, hero panel, "Próximas hazañas"
  cards (FRD-10) and the dashboard footer.

### 4. Tier medals & the Bronze→Legend ladder (`.itemslot` + `.node`)
- **Tokens:** `tiers.tier1..tier5` (the rarity colors), `rpgSkin.itemslot` (the medal slot,
  `image-rendering: pixelated`), `rpgSkin.node` (the 15px ladder pip). Owned visually here, consumed
  by FRD-10's chain cards. Tier name + color always travel together (color is **never** the sole
  signal — the tier name text rides alongside, satisfying "state by shape+text, not color alone").

### 5. The celebration scale (honest, graduated) — auto-firing
The FRD mandates a celebration that **scales**, never flat. Mapped to the frozen motion system:
- **Work order closed → small toast.** `toast()` — a transient bottom chip on `card` surface. No XP
  fireworks.
- **Phase closed → medium entrance.** The `rpgSkin.anim` keyframe (`rpgIn`: 9px rise + fade, 340ms,
  transform/opacity only) replayed on the affected panel.
- **Release → full-screen celebration** and **level-up → full-screen "¡Subiste de nivel!"** are the
  reserved expressive tier — now drawn in the prototype as `bOverlay(kind)` (~L1433): a centered
  `rpgpanel anim` over a dimmed/blurred backdrop, with `bConfetti()` (~L1432, `transform`/`opacity`-only
  fall) — release shows the rocket crest + "+120 XP" + achievement chips; level-up shows the big pixel
  "NV {n}" numeral + new rank + the fresh `XpBar`.
- **The trigger is automatic.** In the real app the celebration fires when `/pandacorp:release` lands a
  shipped product and the level-up fires **on crossing an XP threshold** — **not from a button**. The
  prototype's "Previsualizar celebración / Previsualizar ¡Subiste de nivel!" buttons exist only to
  preview the effect and are wrapped in a DR-061 `SOLO DEMO` block (see §Demo-only controls).
- Expressive motion is **rationed** (frequency test): the everyday guild bar is sober; the celebration
  is the rare expressive moment. All motion honors `prefers-reduced-motion` (the `anim`/`reveal`/
  `bFall` rules gate this — confetti collapses to a static state under reduced-motion).

### 6. Guild radar — "Atributos del gremio" (character attributes)
- **Render fn:** `statRadar()` (~L446), hosted in the Hall's Stats tab (FRD-10). A 6-axis SVG radar
  (`accent` polygon + glow, `bd` rings, pixel-font axis labels). Listed here because "Guild
  Attributes" is named in the FRD as a guild meta-element; FRD-10 owns the host tab.

## States (empty / loading / error)

Gamification is a **read-only derived layer** over the factory (MC never writes XP). The states are
host-driven but the gamified elements define their own fallbacks:
- **Empty / day zero:** level 1, XP bar at its real (possibly low) value — **honest endowed
  progress**, never faked to look further along. The hero line degrades to "Tu primer logro te
  espera" (already in the dashboard foot). Sprite roster: `onerror="this.remove()"` drops any missing
  sprite gracefully (already wired) — no broken-image box.
- **Loading:** the guild bar renders its frame immediately from cached/SSR data (no skeleton for
  server-delivered values, per the Next.js rule); the XP fill animates from 0 to its width on mount.
- **Error / no data:** if the factory read fails, the bar shows the last-known level/title with the
  XP fill omitted rather than a blank panel; numbers fall back to `0` with `tabular-nums` so layout
  never shifts.

## Accessibility notes
- Level/XP is conveyed by **text** ("NV 12", "{xp} / {next} XP") in addition to the bar fill — never
  the bar alone. Tier badges carry the **tier name text**, not just color.
- Pixel-font numerals keep `font-variant-numeric: tabular-nums` (no layout jitter as numbers change).
- The XP bar has a `title` with the exact "{xp} / {next} XP" for hover/AT; consider an
  `aria-label`/`role="progressbar"` with `aria-valuenow/min/max` when implemented.
- Expressive motion gated by `prefers-reduced-motion`.

## Cohesion (DR-062)
The guild bar is the app shell's persistent top bar (one per app), not a per-screen header; the hero/
foot variants sit **under** each host's own light `PageTitle` (`pageHead`) — they never replace it.
Level/XP pills, tier medals and the celebration surface are the shared gamified primitives reused
everywhere; no host re-implements an XP bar, level pill or celebration. The dashboard "Momentos de
gamificación" group divider is the one `SectionHead` (`secthead`).

## Demo-only controls (DR-061)
FRD-09's own elements are read-only derived data, **with one demo affordance**: the dashboard's
**"Previsualizar celebración de release" / "Previsualizar ¡Subiste de nivel!"** buttons
(`dashboardView` ~L764) exist only to preview the auto-firing overlays in the static prototype. They are
wrapped in the prototype's `bDemo` block (dashed border + uppercase **`SOLO DEMO`** tag + note: "En la
app real esto NO tiene botón: la celebración la dispara /pandacorp:release y el level-up se dispara solo
al cruzar un umbral de XP"). On implementation these MUST keep that DR-061 wrapper — the real overlays
fire automatically on the milestone, never from a control. (The dashboard digest's "simular/reiniciar"
links are FRD-12's demo affordances, flagged in FRD-12's FDD.) The guild bar / hero / XP surfaces
themselves gain no state-toggler.

## index.html render-fn pointers
`topbar` (~L646) · `logrosHero` (~L413) · dashboard foot + celebration demo block in `dashboardView`
(~L740/~L764) · `bOverlay` (~L1433) · `bConfetti` (~L1432) · `statRadar` (~L446 group) · `toast`.
CSS: `.xpbar`, `.shield`, `.rpgpanel`, `.rpggrid`, `.itemslot`/`.node` (rpgSkin group), `.tab`/`.tab.on`,
`rpgIn` + `bFall` keyframes (rpgSkin.anim / Group B confetti, gated by `prefers-reduced-motion`).
