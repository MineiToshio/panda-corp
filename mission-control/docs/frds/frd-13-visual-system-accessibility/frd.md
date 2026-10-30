---
id: FRD-13
type: frd
title: FRD-13 — Visual system and accessibility
status: ACTIVE
implementation_status: PLANNED
ui: true
visual_source: docs/design/prototype/index.html
visual_source_mocks: docs/frds/frd-13-visual-system-accessibility/mocks/visual-system-accessibility.html
last_updated: '2026-10-22'
floor: false
---
# FRD-13 — Visual system and accessibility

> **Design system FROZEN FROM the Órbita prototype (owner approval 2026-10-21; supersedes the DR-054 pixel-RPG extraction of 2026-06-18).** The visual system is extracted from the owner-approved prototype (`docs/design/prototype/index.html`, the `visual_source`) into `docs/design/design-tokens.json` (the canonical contract) and `DESIGN.md`, mirrored in `src/app/globals.css`. The warm pixel-RPG palette, the single rationed accent and the 3-level elevation scale of earlier versions no longer describe the product (contradiction C-02 of `docs/design/freeze/reconciliation.md`). The previously unnumbered criteria are now numbered REQ-13-001 to REQ-13-009 in file order (the old `FRD-13#Uk` names map to REQ-13-00k). Prototype-drawn rules are REQ-13-010 (AC-13-010.1 to AC-13-010.4).

Mission Control must feel **engineered, not decorative**, without the owner (weak at design) having to tune anything. The lever is **tokenized restraint**: neutral chrome, hue only where it carries meaning, restrained motion. Its type is Space Grotesk (display), Inter (text) and JetBrains Mono (ids, code, commands, paths).

## Acceptance criteria (EARS)

- **REQ-13-001** — The theme SHALL be derived from **few tokens** — a small, structured set of surface / text / line / hue / tint / shadow / scene tokens per theme, frozen in `docs/design/design-tokens.json` and `DESIGN.md` — instead of dozens of loose, unrelated values, so that touching a hue doesn't throw off the text contrast. The tokens are authored in **hex**. There are exactly **two committed themes** (light and dark, both first-class), and the theme control is a sun/moon toggle between them only. There is no high-contrast mode: no control, no var-override layer and no third theme. (Amended 2026-10-22, v2 plan: the high-contrast option of v1 is removed, owner default O1.)
- **REQ-13-002** — The chrome (surfaces, text, lines, controls) SHALL be **neutral** (graphite / porcelain); hue SHALL be used only where it carries meaning, per AC-13-010.1.
- **REQ-13-003** — EVERY number (XP, levels, per-column counts, stats, timestamps) SHALL use **`font-variant-numeric: tabular-nums`**.
- **REQ-13-004** — Elevation and radius SHALL come from the frozen token scales: the shadow tokens (`shadow`, `shadow-sm`, `node`, `drop`, `panel`, `dialog`, `toast`), the radii (6, 8, 10, 12, 16, 22, 28 px and pill) and a 1px hairline; the light theme re-declares the shadows with softer values. No component SHALL declare its own shadow or radius.
- **REQ-13-005** — Animation SHALL use **only `transform` and `opacity`**, duration **<300ms**, and apply the *frequency test*: what is seen dozens of times a day (tabs, hover) is restrained; the expressive is reserved for rare and satisfying events (achievement notice, completed work order). 2–3 easing tokens, not per-component curves. This includes the sidebar collapse (a transform, never an animated `width`) and the dialog pop (no fade of the dialog's text). (M1 2026-10-22: this rule wins over the prototype, which is corrected.)
- **REQ-13-006** — The UI SHALL honor **`prefers-reduced-motion`**: it disables all La Fragua animation and every other non-essential motion (long sessions → avoid fatigue).
- **REQ-13-007** — NO state SHALL depend on color alone: each state (working / idle / failed / completed) is paired with an **icon or shape + label** (state chips such as "En revisión" with an icon, "Conseguido" with a check, "Bloqueado" with an alert icon).
- **REQ-13-008** — Agent identity SHALL be shown by the agent's **sprite** (initials where it has none) and its **model tier** chip (FRD-07 REQ-07-011); there is NO canonical per-role colour set. The `AGENT_ROLES` list of real engine and pipeline roles (`implementer`, `reviewer`, `test-writer`, `backend-dev`, `frontend-dev`, `researcher`, `product-manager`, `designer`, `copywriter`, `architect`, `analytics`, `security-auditor`, `devops`) remains the roster and SHALL NOT include the fictitious `guild` aggregate.
- **REQ-13-009** — The accessibility SHALL comply: `aria-label` in Spanish on icons, `aria-live="polite"` to announce events without stealing focus, a visible 2 px focus ring that respects the `border-radius`, keyboard list navigation (arrow keys on tab strips), a "Saltar al contenido" skip link as the first focusable element that moves focus to the content in place (it SHALL NOT route to another screen), **contrast ≥4.5:1**, and an accessible name on a progress ring that states its meaning on focus (e.g. "39 de 48 work orders verificadas").

### REQ-13-010 — Colour, type, pointer and scene rules (added 2026-10-22, design freeze)

- **AC-13-010.1** — THE UI SHALL keep its chrome neutral and SHALL use hue only to carry meaning, always together with text or an icon and never as an edge stripe; green, amber and red SHALL mean status or severity only (a project's phase counts as status, the deliberate exception for phase colours).
- **AC-13-010.2** — THE UI SHALL render with the three self-hosted families Space Grotesk, Inter and JetBrains Mono, SHALL NOT render product text below 12 px, and SHALL use monospace only for ids, code, commands and paths.
- **AC-13-010.3** — WHERE the pointer cannot hover, THE UI SHALL apply no hover effect, and a focused element SHALL never sit under a sticky bar (focus is scrolled clear of it).
- **AC-13-010.4** — THE La Fragua scene and the Campaña map SHALL use the always-dark scene tokens in both themes.

**Worked example (AC-13-010.1).** A work order card in review shows an eye icon and the text "En revisión" in the review hue. A card for a failed work order uses the coral status hue with an alert icon and "Bloqueado". A category chip (for example "web") uses a category hue (violet, blue, teal, pink, slate or gold), never green, amber or red.

## Non-goals (v1)
- It is not a publishable design system: it is Mission Control's internal system. It reuses shadcn/Tailwind as vocabulary.

## Relationship
It applies cross-cuttingly to all tabs and surfaces and to the `docs/design/prototype/index.html` prototype, which carries `tabular-nums`, `prefers-reduced-motion` and visible focus as a base.


## Shared modal focus — 2026-10-16

The shared Modal restores keyboard focus to the element that opened it when closing or unmounting, provided that element still belongs to the document. A project switch must not focus a removed opener. This applies to Spec FRD details and other consumers of the same primitive.

## Persistent navigation integration — FRD-25 (2026-10-17)

The [cross-cutting URL contract](../frd-25-persistent-navigation/frd.md) supersedes earlier local-only tab/detail state, exact-root navigation matching and display-name-derived project addresses in this document. Meaningful selections/filters are URL-owned, legacy links retain their resource and presentation context, and reload/Back/Forward restore that location. Existing visual design, data-read boundaries, action gates and machine-status history remain unchanged. Implementation scope and evidence live in FRD-25's blueprint/work-order record and delivery note.
