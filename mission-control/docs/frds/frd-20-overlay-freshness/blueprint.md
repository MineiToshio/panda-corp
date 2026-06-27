---
id: FRD-20-blueprint
type: blueprint
parent: FRD-20
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-26'
---
# Feature blueprint — FRD-20 Project overlay freshness

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how FRD-20 is implemented on top of the platform
> described in [`docs/product/architecture.md`](../../product/architecture.md). It references the
> platform (read-only invariant, testing, tokens) rather than restating it.

## 1. Summary

Surface, at the top of a project's **Resumen**, whether its `.pandacorp/` overlay is at the
factory's current `OVERLAY_VERSION` or behind it. The verdict is pure and computed **server-side**
from data already in hand (the parsed status) plus one small file read; it is rendered through the
shared `Banner` primitive. No route handler and no polling are needed (unlike FRD-15) because the
overlay version only changes when `/pandacorp:upgrade` runs, which re-renders the workspace anyway.

## 2. Platform references

- **Data sources**: `ProjectStatus.overlayVersion` (already parsed by `readStatus`, FRD-01 §4) and
  `plugin/templates/OVERLAY_VERSION` (the upgrade target, DR-051), resolved against the factory root
  (`resolveFactoryRoot`, FRD-01 `lib/config.ts`).
- **Read-only invariant** (architecture §7): only `fs.readFileSync` of `OVERLAY_VERSION`. No write,
  no Claude, no command execution. The badge only *shows* `/pandacorp:upgrade`.
- **Design system** (FRD-13, DR-057): the badge is a **consumer of the one shared `Banner`** (tones
  `warn`/`ok`, `commandRow` → `CmdRow` with `CopyButton`) — not a new banner component.

## 3. Modules

- **`lib/overlay-freshness.ts`** (new) — `readFactoryOverlayVersion(factoryRoot)` and
  `getOverlayFreshness(projectOverlayVersion, factoryRoot?)` → `OverlayFreshnessState`. Self-contained
  semver compare (mirrors `lib/plugin-sync`; the second occurrence is tolerated per the rule of three,
  both comparing a project/installed version against a source version). Defensive: any
  missing/unparseable input → `reason: "unknown"`, never throws.
- **`projects/[slug]/_components/version-freshness/version-freshness.tsx`** (new) — `VersionFreshness`,
  a presentational `Banner` consumer: `behind` → warn + `/pandacorp:upgrade` row; `up-to-date` → ok;
  `unknown` → `null`.
- **`ProjectWorkspace`** (edit) — computes `getOverlayFreshness(status.overlayVersion)` in the summary
  branch and passes it to `TabSummary`.
- **`TabSummary`** (edit) — new optional `overlayFreshness` prop; renders `<VersionFreshness>` at the
  top of the tab (above the summary panel), omitted when the prop is absent.

## 4. Verdict contract

`reason: "behind" | "up-to-date" | "unknown"` from a strict semver compare of project vs factory:
strictly-older → `behind`; equal/newer → `up-to-date`; either side null/unparseable → `unknown`.
`detail` is a Spanish one-liner; `upgradeCommand` is the constant `/pandacorp:upgrade`.

## 5. Testing strategy

- **`lib/overlay-freshness`**: unit tests over a temp factory root — behind / up-to-date / newer /
  equal, `v`-prefix tolerance, and every defensive path (missing file, empty file, unparseable on
  either side, unreadable root) → `unknown`, never throws.
- **`VersionFreshness`**: RTL over the three branches — warn banner + copyable command (behind),
  ok banner + no command (up-to-date), renders nothing (unknown).
- Gate: `.pandacorp/verify.sh` (biome → tsc → vitest). UI change → Preview Smoke verified live (the
  Resumen renders the behind badge for this project: overlay 8.42.1 < factory 8.42.3).
