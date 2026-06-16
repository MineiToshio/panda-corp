# WO-16-001 — `lib/orphans` scan: projects path + bounded folder listing

> Source-of-truth: [`blueprint.md`](../blueprint.md) (`IF-16-scan`) · [architecture §4.2, §7](../../../product/architecture.md).

## Goal
Resolve the projects folder and list the bounded set of candidate folders (immediate git-repo children,
exclusions applied). No classification yet.

## Scope
- `resolveProjectsPath(): string` — `profile.projects_path` (via `lib/profile.ts`); when absent/empty,
  the parent directory of the factory root.
- `listProjectFolders(projectsPath): string[]` — immediate children only, that contain a `.git`
  (file or dir), excluding the factory root and `mission-control/`.

## Acceptance criteria (REQ-16-006, REQ-16-005)
- **AC-16-001.1** WHEN `profile.projects_path` is set, `resolveProjectsPath` returns it.
- **AC-16-001.2** WHEN the profile is missing or `projects_path` is empty, it returns the parent of the
  factory root.
- **AC-16-001.3** (REQ-16-006) `listProjectFolders` returns ONLY immediate children — a `.git` nested
  two levels down is NOT discovered (bounded scan; assert with a fixture tree).
- **AC-16-001.4** Only folders with a `.git` (file OR dir) are returned; plain folders are skipped.
- **AC-16-001.5** The factory root and `mission-control/` are excluded even if they have `.git`.
- **AC-16-001.6** (REQ-16-005) An unreadable `projects_path` returns `[]` (no throw); the scan performs
  no write and runs no `git` subprocess (existence check only).

## TDD
`lib/orphans.test.ts` with a fixture project-folder tree (some with `.git`, some nested, the factory &
mission-control siblings). Point readers at it via `PANDACORP_FACTORY_ROOT` / a profile fixture.

## Definition of done
- ACs RED → GREEN. Bounded to immediate children; exclusions enforced; defensive. `.pandacorp/verify.sh` green.

## Dependencies
- FRD-01 `lib/config.ts`, `lib/profile.ts` — shipped.
