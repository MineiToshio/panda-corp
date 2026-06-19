---
id: FRD-13
type: frd
title: FRD-13 — Visual system and accessibility
status: ACTIVE
implementation_status: VERIFIED
ui: true
visual_source: docs/design/prototype/index.html
last_updated: '2026-06-19'
---
# FRD-13 — Visual system and accessibility

> **Design system FROZEN FROM the prototype (DR-054 ADOPT-VISUAL, 2026-06-18).** The visual system below is no longer derived from an invented palette: it is **extracted faithfully from the owner-approved prototype** (`prototype/index.html`, the `visual_source`) into `docs/design/design-tokens.json` (the canonical contract) and mirrored in `src/app/globals.css`. This **supersedes** the earlier *invented* cold-blue (hue ~230) OKLCH palette that `docs/design/brief.md` had introduced — DR-054 establishes that an owner-approved visual overrides FRD-13's palette **and its color-space choice**: the prototype is authored in **hex** (warm pixel-RPG / "guild" palette, dark default + light + high-contrast), so the committed tokens are hex. The per-agent role-identity colors remain OKLCH (perceptual spacing keeps the roles distinguishable). Where an acceptance criterion below cites a value the re-anchor changed, the criterion is annotated **(DR-054)**.

Mission Control must feel **engineered, not decorative**, without the owner (weak at design) having to tune anything. The lever is **tokenized restraint**: few colors, few theme variables, restrained motion. It keeps the warm Anthropic-style pixel-RPG palette approved in the prototype.

## Acceptance criteria (EARS)

- The theme SHALL be derived from **few tokens** — a small, structured set of surface / text / border / accent / status tokens per theme — instead of dozens of loose, unrelated values, so that touching the accent doesn't throw off the text contrast and a **high-contrast mode** can be enabled without a redesign. **(DR-054)** The tokens are authored in **hex**, frozen from the prototype (the earlier OKLCH/perceptual-space mandate is superseded by the approved visual); the only OKLCH set retained is the per-agent role-identity palette. There are exactly **two committed themes** (dark default + light); high-contrast is a var-override layer over the dark theme (pure black/white extreme inversion), not a third token theme.
- The UI SHALL use **a single rationed accent** (punctuation, not paint): accent only on what matters (active tab, working agent, XP bar); the rest, warm neutrals.
- EVERY number (XP, levels, per-column counts, stats, timestamps) SHALL use **`font-variant-numeric: tabular-nums`**.
- Elevation SHALL have **3 levels** (canvas → resting → pop) with a tokenized shadow/radius scale (radius 8px, base 16px, hairline 1px). **(DR-054)** The prototype's elevation is a two-layer box-shadow scale wired as `--shadow-0` (none), `--shadow-1` (resting) and `--shadow-2` (pop); the light theme re-declares `--shadow-1/2` with softer values. The earlier "spacing in 0.25rem multiples" per-elevation-level spacing token is superseded — the prototype carries a compact spacing scale separately, not a per-level spacing field.
- Animation SHALL use **only `transform` and `opacity`**, duration **<300ms**, and apply the *frequency test*: what is seen dozens of times a day (tabs, hover) is restrained; the expressive is reserved for rare and satisfying events (achievement, level-up, completed work order). 2–3 easing tokens, not per-component curves.
- The UI SHALL honor **`prefers-reduced-motion`**: it disables all Party animation (long sessions → avoid fatigue).
- NO state SHALL depend on color alone: each state (working / idle / failed / completed) is paired with an **icon or shape + label** (critical with a warm palette, where reds/oranges/amber are close together).
- The canonical **agent-role set** (`AGENT_ROLES` / `AGENT_COLOR` in `app/_design/tokens.ts` — the single source for FRD-06 La Fragua + FRD-12) SHALL match the **real engine and pipeline roles** and carry a fixed color token each: the build/review roles `implementer`, `reviewer`, and the deep-split `test-writer` / `backend-dev` / `frontend-dev`; and the per-phase specialists `researcher` / `product-manager` / `designer` / `copywriter` / `architect` / `analytics` / `security-auditor` / `devops`. It SHALL NOT include the fictitious `guild` aggregate (realigned 2026-06-18 with the Party redesign — see `docs/decision-log.md` and `prototype/party-redesign-spec.md` §2).
- The accessibility SHALL comply: `aria-label` in Spanish on icons, `aria-live="polite"` to announce events without stealing focus, a visible focus ring that respects the `border-radius`, keyboard list navigation, **contrast ≥4.5:1** (a real risk with light warms).

## Non-goals (v1)
- It is not a publishable design system: it is Mission Control's internal system. It reuses shadcn/Tailwind as vocabulary.

## Relationship
It applies cross-cuttingly to all tabs (FRD-02 through FRD-06, FRD-10) and to the `prototype/index.html` prototype, which already incorporates `tabular-nums`, `prefers-reduced-motion` and visible focus as a base.
