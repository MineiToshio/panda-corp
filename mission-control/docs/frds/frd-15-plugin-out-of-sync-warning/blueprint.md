---
id: FRD-15-blueprint
type: blueprint
parent: FRD-15
status: ACTIVE
implementation_status: VERIFIED
last_updated: '2026-06-17'
---
# Feature blueprint — FRD-15 Plugin out-of-sync warning

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how FRD-15 is implemented on top of the platform
> described in [`docs/product/architecture.md`](../../product/architecture.md). It does not restate the
> platform (stack, read-only invariant, testing strategy, deploy posture) — it references it.

## 1. Summary

Detect the most common factory slip — the factory `plugin/` advanced but the **installed** copy is
an older version, so newly added/edited skills don't take effect until `claude plugin update` — and
surface a **persistent, read-only drift banner** with the exact recovery command. A single local
drift source: the **installed semver `version` is behind the source `version`**.

The drift truth is computed on the **server** (it needs fs access to read two JSON files), exposed
via a small **route handler** ([architecture §3, §8](../../product/architecture.md)), and rendered
by a client banner that polls so it can **disappear on its own** when sync is restored (REQ-15-004).

Critical invariant (amended 2026-06-22 — version-based; from the FRD and `lib/plugin-sync`): the
drift check compares the installed **semver `version`** (`~/.claude/plugins/installed_plugins.json`)
against the **source `version`** (`plugin/.claude-plugin/plugin.json`) — the SAME signal
`claude plugin update` uses. The banner fires ONLY when the installed version is strictly behind the
source version. (Previously this compared git **commit SHAs** + an uncommitted-changes check; that
was abandoned because `installed_plugins.json.gitCommitSha` is frozen at install time and never
advances, producing a permanent false "behind" alarm — see the FRD's amendment note.)

## 2. Platform references

- **Data sources** (architecture §4.7): `~/.claude/plugins/installed_plugins.json` (the semver
  `version` of `pandacorp@panda-corp`, user scope — the version `claude plugin update` maintains);
  `plugin/.claude-plugin/plugin.json` (the source `version`, the authoritative "latest published").
- **`lib/plugin-sync/plugin-sync.ts`** (architecture §6): owns the two fs reads + the semver
  comparison for this feature. New module.
- **Read-only invariant** (architecture §7): only two file reads. No git, no write, no Claude, no
  execution of the update command.
- **Surface** (architecture §11): dashboard banner + route handler `app/api/plugin-sync/`.

## 3. Components & interfaces

### Interfaces (`lib/**`)

**`IF-15-sync` — `lib/plugin-sync/plugin-sync.ts`** (new module, architecture §6).
Pure-ish readers (paths/root in → typed data out), unit-tested with fixtures.

```ts
// All paths resolved via lib/config.ts (resolveFactoryRoot / PANDACORP_FACTORY_ROOT) + ~/.claude.
type PluginSyncState = {
  installedVersion: string | null;  // semver `version` of pandacorp@panda-corp, or null if not installed/unreadable
  sourceVersion: string | null;     // semver `version` from plugin/.claude-plugin/plugin.json, or null if unreadable
  drift: boolean;                    // true ONLY when installedVersion is strictly behind sourceVersion
  reason: "behind" | "in-sync" | "unknown";
  detail: string;                    // human (Spanish) one-liner for the banner, always non-empty
};

readInstalledVersion(claudeHome: string): string | null;      // parse installed_plugins.json → version, defensively
readPluginSourceVersion(factoryRoot: string): string | null;  // parse plugin/.claude-plugin/plugin.json → version
getPluginSyncState(): PluginSyncState;                         // composes the two reads + semver comparison into the verdict
```

Defensive contract: any unreadable/missing/unparseable input (no `installed_plugins.json`, plugin
not listed, missing/empty `version`) → that field is `null` and `reason` degrades to `"unknown"`,
never throws. `drift` is only `true` on a **positive** signal (installed semver strictly older than
source semver); an `unknown` or `in-sync` state does NOT raise the alarm (no false positives —
REQ-15-005 read-only/honest).

### Route handler

**`CMP-15-route` — `app/api/plugin-sync/route.ts`** (Server, Node runtime).
`GET` → `getPluginSyncState()` as JSON. Exists because the file reads need Node outside a Server
Component render and the banner polls it (architecture §3, §8). `export const runtime = "nodejs"`
and `dynamic = "force-dynamic"` (never cached — drift is live state).

### UI components

**`CMP-15-banner` — `components/plugin-sync-banner.tsx`** (`"use client"`).
Polls `IF-15-sync` via `CMP-15-route` on mount + on an interval; renders the warning **only when
`drift === true`** (reason `behind`); otherwise renders nothing (self-clearing, REQ-15-004). Shows the
"installed behind" copy and the **command to copy** through the shared **`CopyButton`** (FRD-02
component). Visual reference: `prototype/index.html` `pluginBanner()` — amber `--warn` panel,
alert-triangle icon, the recall steps (run command → restart session), command row.

**`CMP-15-recall` — the recovery copy** (inside `CMP-15-banner`): command
`claude plugin update pandacorp@panda-corp` + the sequence text (run command → restart the Claude
Code session). REQ-15-003.

The banner is mounted by the dashboard (FRD-18 composes the health banners); FRD-15 owns the
component and its data, FRD-18 places it.

## 4. Behavior / contracts

| Trigger | `reason` | Banner copy (Spanish, summarized) |
|---|---|---|
| installed `version` strictly behind source `version` | `behind` | "El plugin instalado está atrás" + recall (run → restart) |
| installed `version` equals or newer than source | `in-sync` | (no banner) |
| either version missing/unparseable | `unknown` | (no banner — never a false alarm) |

The command is **always** `claude plugin update pandacorp@panda-corp`; the recall is "run the command →
restart the session". The banner never executes anything (REQ-15-005). (Uncommitted-in-`plugin/` is
deliberately NOT a trigger — owner decision 2026-06-22; in the factory the owner edits `plugin/`
constantly, so only a genuinely older *installed version* warrants the banner.)

## 5. Traceability (`REQ-15-MMM` → AC → components)

IDs follow the FRD's acceptance criteria. Restated in the work orders as `AC-15-MMM.K`.

| REQ | Acceptance criterion (EARS) | Satisfied by |
|---|---|---|
| REQ-15-002 | Installed `version` strictly behind source `version` (semver) → "installed plugin is behind"; equal/newer → nothing; missing/unparseable → `unknown`, nothing | `IF-15-sync` (`readInstalledVersion`, `readPluginSourceVersion`, semver `drift`), `CMP-15-banner` |
| REQ-15-004 | Warning disappears on its own once the installed version catches up | `CMP-15-banner` (poll + render-only-on-drift), `IF-15-sync` (`in-sync`) |
| REQ-15-005 | Read-only: shows the copyable `claude plugin update …` command, never executes; unreadable input → `unknown`, never throws | `IF-15-sync` (two file reads only), `CMP-15-recall`, `CMP-15-route`, architecture §7 |

> **Retired:** REQ-15-001 (uncommitted-changes warning) and REQ-15-003 (separate command-copy REQ) no
> longer exist after the 2026-06-22 version-based amendment. Uncommitted `plugin/` edits are no longer a
> trigger; the copyable command is folded into AC-15-004.1 of REQ-15-002. The version-drift case is now
> the **single** drift reason.

All live REQ map to concrete components. No criterion is unsatisfiable on the platform.

## 6. Notes / risks

- **`installed_plugins.json` shape** can vary by Claude version; parse defensively (locate the
  `pandacorp@panda-corp` entry, read its semver `version`; tolerate both the canonical array-of-entries
  form and a single-object form), tolerate absence/empty → `null`/`unknown`.
- **Semver comparison.** Parse `MAJOR.MINOR.PATCH` numerically (strip an optional leading `v` and any
  pre-release/build suffix); `behind` only when the installed tuple is strictly less than the source
  tuple, `in-sync` when equal or ahead, `unknown` when either is unparseable — captured as ACs in WO-15-002.
- **No `simple-git` / no git dependency** — the verdict is two JSON file reads + a numeric semver
  compare; no `child_process`, no git probe (consistent with the trimmed stack, architecture §2).
- **Historical:** an earlier design compared the installed `gitCommitSha` against `git log -1 -- plugin/`
  plus a `git status --porcelain` dirty check. Abandoned 2026-06-22 because the installed `gitCommitSha`
  is frozen at install time and never advances → a permanent false "behind" alarm.

## Build Plan (Phase 2)

Phase-2 re-anchors the **presentational** layer of FRD-15 to the owner-approved prototype. The `lib/` +
route layer is **VERIFIED and untouched** — only the UI banner is re-planned.

**Coarse WO set:**

| WO | Status | Layer | Artifacts (disjoint) |
|---|---|---|---|
| WO-15-001 `sync-readers` | **VERIFIED** (kept) | lib | `src/lib/plugin-sync/plugin-sync.ts` (version readers) |
| WO-15-002 `sync-verdict` | **VERIFIED** (kept) | lib | `src/lib/plugin-sync/plugin-sync.ts` (semver verdict) |
| WO-15-003 `sync-route` | **VERIFIED** (kept) | route | `src/app/api/plugin-sync/**` |
| WO-15-004 `sync-banner` | **PLANNED** (re-plan) | UI | `src/app/_components/plugin-sync-banner/**` |

**DAG / parallelism:** WO-15-004 is the only Phase-2 work order. It depends on the three VERIFIED lib/route
WOs (already shipped) and on the foundation **WO-13-007** (the shared `Banner`). It has no peer in this FRD,
so there is no intra-FRD parallelism; it runs once WO-13-007 is VERIFIED. Its artifact glob
(`src/app/_components/plugin-sync-banner/**`) is **disjoint** from every other FRD's UI WO — no collision
with FRD-16's `orphans-banner/**` or FRD-18's dashboard surfaces.

**Cross-FRD deps:** `frd-13` (the shared `Banner`/`CmdRow`/`CopyButton` — WO-13-007). The plugin-drift
banner is the `kind="drift"` **consumer** of that one `Banner`; it must NOT re-declare a banner style
block (the DR-057 duplicate-banner defect this Phase-2 WO exists to fix).

## R9 adapter-aware freshness

`PluginSyncState.runtimes` contains independent `claude` and `codex` `RuntimePluginSyncVerdict` values. Claude reads `~/.claude/plugins/installed_plugins.json` and its source manifest; Codex reads the explicitly activated `PANDACORP_CODEX_PLUGIN_ROOT` (with a conservative standard-cache fallback) and its own generated source manifest. The old top-level Claude fields remain additive compatibility fields for shipped clients.
