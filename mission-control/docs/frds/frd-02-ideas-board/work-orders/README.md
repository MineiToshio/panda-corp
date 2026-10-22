# Work orders — FRD-02 Ideas board (v2 «Órbita»)

> The authoritative order + parallelism is the **Build Plan** in `../blueprint.md` (the build engine reads that, not
> this). This file is the readable summary. Each WO is a **coarse slice** (one cohesive view/capability), carries its
> own `implementation_status` frontmatter, and copies in its acceptance criteria. v2 work orders are `PLANNED`; the
> kept v1 work orders are `VERIFIED` libraries and owners of unchanged criteria (wo-map §0.5).

## Work orders

| WO | Slug | Status | Depends on | Summary |
|---|---|---|---|---|
| WO-02-019 | data-model-layout-flake | PLANNED | — | Confirm (debugging SOP) and fix the async-layout «Organizando modelo…» flake of the data-model viewer; regression test anchored in the cause. |
| WO-02-004 | discard-idea | VERIFIED | WO-01-000 | Kept v1: bounded discard/restore write and its Server Actions (ADR-0002). |
| WO-02-012 | favorite | VERIFIED | WO-01-003, WO-02-004 | Kept v1: the favourite write (ADR-0003); owner of AC-02-012.1/.2. |
| WO-02-001 | derive-column | VERIFIED | WO-01-003, WO-01-005 | Kept v1: two-axis board-column derivation. |
| WO-02-003 | next-step | VERIFIED | WO-01-005 | Kept v1: lifecycle → next-command map. |
| WO-02-011 | phase-from-status | VERIFIED | WO-01-003, WO-01-005 | Kept v1: active campaign phase derivation; owner of AC-02-010.2. |
| WO-02-015 | board-orbita | PLANNED | WO-13-012, WO-25-001, WO-02-012 | Tablero Órbita: numbered phase columns, search, phase chips, hide-empty, category filter + match count, favourite star, capture and discarded dialogs; creates the FRD e2e spec. |
| WO-02-017 | spec-architecture-digests | PLANNED | WO-13-012, WO-25-001 | Shared Spec and Arquitectura digests on `ReportBand` / `FrdCard`: bands, FRD and ADR dialogs, env groups, plan mosaic, not-published state; WoDag removed. |
| WO-02-018 | data-model-viewer-orbita | PLANNED | WO-13-012, WO-02-019 | Data-model viewer restyle on the kept engine: Segmented Diagrama/Esquema, compact toolbar with native fullscreen, relations list, none/error states; v2 removals. |
| WO-02-020 | campaign-orbita | PLANNED | WO-13-012, WO-11-003, WO-25-001 | La Campaña Órbita: dark map, rooms and corridors, strip, pinned phase sheet, commands with spec modes, build-mode picker, forge link; Claude Design sunset copy. |
| WO-02-013 | next-step-interpolate-idea-name | VERIFIED | WO-02-003, WO-02-011 | Kept v1: slug interpolation of `<idea>` in the Campaña commands. |
| WO-02-016 | idea-page | PLANNED | WO-02-017, WO-02-004, WO-02-012, WO-25-001, WO-02-015, WO-02-020, WO-08-003 | Idea page route: header, icon tabs with stage default, Propuesta, Documentos index + reader, discard/restore dialogs; detaches the idea from the board. |

> **Depends on** mirrors each WO's `dependsOn` frontmatter (DR-087).

## Build order

- **W0:** WO-02-019 (alone in FRD-02; investigate-then-fix on the current viewer before any restyle).
- **W1-W2 (kept v1, VERIFIED, not rebuilt):** WO-02-004 (W1), WO-02-012 (W2).
- **W3:** WO-02-015, WO-02-017, WO-02-018, WO-02-020 in parallel (disjoint artifacts, blueprint § Build Plan), after the
  foundation (WO-13-012), the URL codec (WO-25-001) and the build-mode picker (WO-11-003); kept v1 WO-02-001,
  WO-02-003, WO-02-011 sit in W3 by their dependencies.
- **W4:** WO-02-016 composes the W3 outputs (digests, Campaña with `forgeHref`, `FavoriteButton`) plus `Paper`
  (WO-08-003) and moves the idea out of the board; kept v1 WO-02-013 sits in W4.
- **Cross-FRD:** WO-04-010 (W5) mounts `SpecDigest`, `ArchitectureDigest` and `DataModelViewer` in the workspace;
  WO-13-013 (W7) depends on WO-02-015, WO-02-016, WO-02-018, WO-02-020.

## AC coverage

| AC | WO |
|---|---|
| AC-02-009.1 | WO-02-016 |
| AC-02-009.2 | WO-02-016 |
| AC-02-009.3 | WO-02-016 |
| AC-02-009.4 | WO-02-016 |
| AC-02-009.5 | WO-02-016 |
| AC-02-009.6 | WO-02-016 |
| AC-02-009.7 | WO-02-016 |
| AC-02-009.8 | WO-02-016 |
| AC-02-010.1 | WO-02-020 |
| AC-02-010.2 | WO-02-011 |
| AC-02-010.3 | WO-02-020 |
| AC-02-010.4 | WO-02-020 |
| AC-02-010.5 | WO-02-020 |
| AC-02-010.6 | WO-02-020 |
| AC-02-010.7 | WO-02-020 |
| AC-02-010.8 | WO-02-020 |
| AC-02-010.9 | WO-02-020 |
| AC-02-010.10 | WO-02-020 |
| AC-02-010.11 | WO-02-020 |
| AC-02-010.12 | WO-02-020 |
| AC-02-011.1 | WO-02-017 |
| AC-02-011.2 | WO-02-017 |
| AC-02-011.3 | WO-02-017 |
| AC-02-011.4 | WO-02-017 |
| AC-02-012.1 | WO-02-012 |
| AC-02-012.2 | WO-02-012 |
| AC-02-012.3 | WO-02-015 |
| AC-02-012.4 | WO-02-015 |
| AC-02-013.1 | WO-02-017 |
| AC-02-013.2 | WO-02-017 |
| AC-02-013.3 | WO-02-017 |
| AC-02-013.4 | WO-02-017 |
| AC-02-013.5 | WO-02-017 |
| AC-02-013.6 | WO-02-017 |
| AC-02-015.1 | WO-02-018 |
| AC-02-015.2 | WO-02-018 |
| AC-02-015.3 | WO-02-018 |
| AC-02-015.4 | WO-02-018 |
| AC-02-015.5 | WO-02-018 |
| AC-02-015.6 | WO-02-018 |
| AC-02-015.7 | WO-02-018 |
| AC-02-015.8 | WO-02-018 |
| AC-02-015.9 | WO-02-018 |
| AC-02-015.10 | WO-02-018 |
| AC-02-015.11 | WO-02-019 |
| AC-02-015.12 | WO-02-018 |
| AC-02-015.13 | WO-02-018 |
| AC-02-015.14 | WO-02-016 |
| AC-02-016.1 | WO-02-015 |
| AC-02-016.2 | WO-02-015 |
| AC-02-016.3 | WO-02-015 |
| AC-02-016.4 | WO-02-015 |
| AC-02-016.5 | WO-02-016 |
| AC-02-016.6 | WO-02-020 |
| AC-02-016.7 | WO-02-017 |
| AC-02-016.8 | WO-02-017 |
| AC-11-005.3 | WO-02-020 |

56 live FRD-02 criteria, each owned by exactly one live work order (wo-map §7 and §8.1), plus FRD-11's AC-11-005.3
drawn in FRD-02's Construcción sheet.

## Superseded (v1 history)

- WO-02-005 (board surface, VERIFIED) → superseded by WO-02-015.
- WO-02-007 (La Campaña card detail, VERIFIED) → superseded by WO-02-016, WO-02-017, WO-02-020.
- WO-02-014 (accessible empty-column marker, IN_REVIEW) → superseded by WO-02-015 (REQ-02-014 copy «Sin ideas en esta fase» replaces the «columna» wording).

## Definition of done (every WO)

- Acceptance-criteria tests first (fast-lane builders write code and tests together, DR-126) with production-shaped
  fixtures (`PANDACORP_FACTORY_ROOT`) and a malformed fixture that must fail loud for every reader (DR-078).
- `.pandacorp/verify.sh --since <ref>` green per WO; the full gate at the FRD-02 gate.
- Tokens only, every UI string from `t()` over `docs/design/microcopy.es.json`, `data-testid` on interactive
  elements, recorded prototype hooks kept.
- Only the bounded writes touch the filesystem (`lib/discard/`, `lib/favorite/`, ADR-0002/0003); no AI dependency.
- Derogated tests handled per the blueprint's test-side supersession (BL-0051): implementer tests updated in the
  same WO, reviewer tests (`*.reviewer.*`) and blessed baselines left to the gate reviewer.
