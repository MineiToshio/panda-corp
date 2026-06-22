# FRD-19 mocks — global app shell

The visual contract is a **slice of the frozen whole-app prototype**, not a separate mock file
(DR-054/056): the persistent topbar is rendered on every view of the prototype, so the canonical
reference is the prototype itself.

## Source slice
- File: [`docs/design/prototype/index.html`](../../../design/prototype/index.html)
- Functions: `topbar()` (~L646), `tab(id,label)` (L650), `tabProp()` (L652) — the brand + guild block,
  the six `.tab` destinations, and the Propuestas pill with its open-count badge.
- Visual tokens: `.tab` / `.tab.on` (L62–63); the `rpgpanel` / `rpggrid` surface signature; the
  brand logo `assets/pandacorp.png`.
- Live prototype (served): `/prototype/index.html` (the topbar is visible on every view).

## The six destinations (the nav contract)
| Label | Route | Prototype `tab()` id |
|---|---|---|
| Inicio | `/` | `dashboard` |
| Tablero | `/board` | `ideas` |
| Portfolio | `/portfolio` | `portfolio` |
| Propuestas | `/proposals` | `propuestas` (`tabProp()`, with badge) |
| Logros | `/achievements` | `logros` |
| Documentación | `/manual` | `manual` |

This table is the source of `e2e/shell.ts` `NAV_DESTINATIONS` (the Shell-Presence Gate contract) and
of the `Nav` component's link list. They must agree.

## Not separate mock HTML
Per the re-anchor (DR-056), surfaces are repainted to the prototype directly; the topbar has no
standalone mock — the prototype `topbar()` is the byte-level reference. Fidelity is verified by the
Shell-Presence Gate (`e2e/shell.spec.ts`) against the contract above, plus the browser smoke at
desktop and mobile widths.
