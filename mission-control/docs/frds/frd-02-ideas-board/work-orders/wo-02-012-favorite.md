---
id: WO-02-012
type: work-order
slug: favorite
title: WO-02-012 — Favourite flag (visual highlight, any column)
status: ACTIVE
parent: FRD-02
foundation: false
implementation_status: VERIFIED
artifacts:
  - 'src/lib/favorite/favorite.ts'
  - 'src/lib/favorite/_tests/favorite.test.ts'
  - 'src/components/core/FavoriteButton/FavoriteButton.tsx'
  - 'src/components/core/FavoriteButton/_tests/FavoriteButton.test.tsx'
  - 'src/app/board/actions/actions.ts'
  - 'src/components/modules/IdeaCard/IdeaCard.tsx'
  - 'src/lib/ideas/ideas.ts'
  - 'src/app/board/IdeaBoardView/IdeaBoardView.tsx'
  - 'src/app/board/_components/BoardShell/BoardShell.tsx'
source_requirements: [REQ-02-012]
dependsOn: [WO-01-003, WO-02-004]
last_updated: '2026-10-22'
---
# WO-02-012 — Favourite flag (visual highlight, any column)

> **Kept live in v2 «Órbita» (wo-map §0.5, 2026-10-22).** VERIFIED bounded write (ADR-0003), unchanged in v2. It
> remains the owner of AC-02-012.1 and AC-02-012.2 (re-copied verbatim below); the star toggle of AC-02-012.3 and the
> retired highlight of AC-02-012.4 are now owned by WO-02-015, which restyles the star and removes the gold card
> highlight. `dependsOn` pruned of WO-02-005 (SUPERSEDED by WO-02-015, see the delivery record).

## Summary

The board's third bounded write: `setFavorite(slug, favorite)` sets or removes only the `favorite` frontmatter field
of one idea card (body and every other field verbatim), called through the `toggleFavoriteAction` Server Action.

**Modules:** `lib/favorite/favorite.ts` (write) · `app/board/actions/actions.ts#toggleFavoriteAction`
(Server Action) · `components/core/FavoriteButton/FavoriteButton.tsx` (client star toggle) ·
`components/modules/IdeaCard/IdeaCard.tsx` (gold highlight) · `lib/ideas/ideas.ts` (parse `favorite`) ·
`app/board/IdeaBoardView/IdeaBoardView.tsx` + `app/board/_components/BoardShell/BoardShell.tsx` (wiring)
**IDs touched:** `CMP-02-favorite`, `CMP-02-favorite-action`, `IF-02-setFavorite`, `CMP-02-card`; REQ-02-012
**Dependencies:** WO-01-003 (`readIdeas`), WO-02-004 (discard write pattern)

## Requirements & Acceptance Criteria

- **AC-02-012.1** — WHEN the owner marks a card as favourite, THE system SHALL write `favorite: true`
  in that card's `.md` frontmatter, preserving the body and all other fields verbatim.
- **AC-02-012.2** — WHEN the owner unmarks a favourite, THE system SHALL **remove** the `favorite`
  field (a non-favourite card carries no `favorite` key — same discipline as the optional
  `discard_reason`). The write SHALL never touch `status` or any other field.

## v1 delivery record

- v1 dependency on WO-02-005 (board surface) pruned 2026-10-22: WO-02-005 is SUPERSEDED by WO-02-015.
- v1 AC-02-012.3: a star toggle on every board card + the detail header toggles the flag via a Server
  Action with optimistic UI; outline `ti-star` ↔ filled gold `ti-star-filled`; Spanish aria-label + aria-pressed.
- v1 AC-02-012.4: a favourite card gets a gold (`--color-warn`) background + border; the state is also
  carried by the aria-label + the filled-star control (never colour alone).

## Contract

```ts
type FavoriteResult = { ok: true; favorite: boolean } | { ok: false; reason: "not-found" | "parse-error" };
export function setFavorite(slug: string, favorite: boolean, ideasDir?: string): FavoriteResult;
// Server Action: toggleFavoriteAction(slug, favorite) → setFavorite + revalidatePath("/board")
```

- `setFavorite` mirrors `discard`/`restore`: same path-traversal + symlink + trailing-newline guards,
  rewrites only the `favorite` field (`true` sets it, `false` removes it), body + other fields verbatim.
- The board's **third write** (ADR-0003); isolated to `lib/favorite/`, human-triggered, never during a render.
- **Visual-only**: it never changes `status` or the derived board column. `readIdeas` parses
  `favorite: true` → `favorite === true`; anything else (absent / `false` / non-bool) → `undefined`.

## Definition of done

- `lib/favorite/_tests/favorite.test.ts` (RED first, temp-dir copies): mark → `favorite: true`;
  unmark → field removed; status untouched; body + other fields verbatim; idempotent; guards
  (empty/missing/traversal → not-found; malformed → parse-error, file untouched).
- `components/core/FavoriteButton/_tests/FavoriteButton.test.tsx`: outline/filled by state; aria-pressed
  + aria-label; click calls the action with the toggled value; optimistic flip while in flight.
- `components/modules/IdeaCard/_tests/IdeaCard.test.tsx`: favourite card carries `data-favorite` +
  the favourite word in the aria-label; non-favourite carries neither.
- `lib/ideas/_tests/ideas.test.ts`: `favorite: true` → true; absent / `false` → undefined.
- `.pandacorp/verify.sh` green (biome + tsc + vitest).

## Status

- [x] DONE — 2026-06-28. Implemented directly with TDD (owner request). 464 board/lib tests GREEN
  (vitest), tsc + biome clean. Third write recorded in ADR-0003 + architecture §6/§7.
