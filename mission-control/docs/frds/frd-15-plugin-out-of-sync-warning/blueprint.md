---
id: FRD-15-blueprint
type: blueprint
parent: FRD-15
status: ACTIVE
implementation_status: PLANNED
last_updated: '2026-06-16'
---
# Feature blueprint — FRD-15 Plugin out-of-sync warning

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how FRD-15 is implemented on top of the platform
> described in [`docs/product/architecture.md`](../../product/architecture.md). It does not restate the
> platform (stack, read-only invariant, testing strategy, deploy posture) — it references it.

## 1. Summary

Detect the most common factory slip — editing `plugin/` and forgetting to commit / run
`claude plugin update` — and surface a **persistent, read-only drift banner** with the exact
recovery command. Two independent drift sources, both local: (a) **uncommitted changes** under
`plugin/`, and (b) **installed SHA behind** the last commit that touched `plugin/`.

The drift truth is computed on the **server** (it needs git + fs access), exposed via a small
**route handler** ([architecture §3, §8](../../product/architecture.md)), and rendered by a client
banner that polls so it can **disappear on its own** when sync is restored (REQ-15-004).

Critical invariant (from the FRD's implementation note and architecture §4.7): the drift check
compares the installed **`gitCommitSha`** against `git log -1 --format=%H -- plugin/` — **never the
semver `version`** (the version can match while the SHA is behind).

## 2. Platform references

- **Data sources** (architecture §4.7): `~/.claude/plugins/installed_plugins.json` (the
  `gitCommitSha` of `pandacorp@panda-corp`, user scope); the factory git repo for
  `git log -1 --format=%H -- plugin/` and `git status --porcelain -- plugin/`.
- **`lib/plugin-sync.ts`** (architecture §6): owns all the fs + git reads for this feature. New module.
- **Read-only invariant** (architecture §7): git is invoked with **read-only** commands only
  (`git status --porcelain`, `git log -1`). No write, no Claude, no execution of the update command.
- **Surface** (architecture §11): dashboard banner + route handler `app/api/plugin-sync/`.

## 3. Components & interfaces

### Interfaces (`lib/**`)

**`IF-15-sync` — `lib/plugin-sync.ts`** (new module, architecture §6).
Pure-ish readers (paths/root in → typed data out), unit-tested with fixtures.

```ts
// All paths resolved via lib/config.ts (resolveFactoryRoot / PANDACORP_FACTORY_ROOT).
type PluginSyncState = {
  installedSha: string | null;   // gitCommitSha of pandacorp@panda-corp, or null if not installed/unreadable
  pluginHeadSha: string | null;  // git log -1 --format=%H -- plugin/  (null if git/path unreadable)
  dirty: boolean;                 // git status --porcelain -- plugin/ is non-empty
  drift: boolean;                 // dirty || (installedSha && pluginHeadSha && installedSha !== pluginHeadSha)
  reason: "uncommitted" | "behind" | "both" | "in-sync" | "unknown";
  detail: string;                 // human (Spanish) one-liner for the banner, e.g. "instalado 18a9389 · hay cambios sin commitear"
};

readInstalledSha(claudeHome: string): string | null;     // parse installed_plugins.json defensively
readPluginHeadSha(factoryRoot: string): string | null;   // git log -1 --format=%H -- plugin/
readPluginDirty(factoryRoot: string): boolean;           // git status --porcelain -- plugin/ non-empty
getPluginSyncState(): PluginSyncState;                    // composes the three above into the verdict
```

Defensive contract: any unreadable/missing input (no `installed_plugins.json`, plugin not listed,
git not available, not a repo) → that field is `null`/`false` and `reason` degrades to `"unknown"`,
never throws. `drift` is only `true` on a **positive** signal (dirty, or two known SHAs that differ);
an `unknown` state does NOT raise the alarm (no false positives — REQ-15-005 read-only/honest).

### Route handler

**`CMP-15-route` — `app/api/plugin-sync/route.ts`** (Server, Node runtime).
`GET` → `getPluginSyncState()` as JSON. Exists because the git probe needs Node/`child_process`
outside a Server Component render and the banner polls it (architecture §3, §8). `export const
runtime = "nodejs"` and `dynamic = "force-dynamic"` (never cached — drift is live state).

### UI components

**`CMP-15-banner` — `components/plugin-sync-banner.tsx`** (`"use client"`).
Polls `IF-15-sync` via `CMP-15-route` on mount + on an interval; renders the warning **only when
`drift === true`**; otherwise renders nothing (self-clearing, REQ-15-004). Shows the reason copy and
the **command to copy** through the shared **`CopyButton`** (FRD-02 component). Visual reference:
`prototype/index.html` `pluginBanner()` (lines 563–567) — amber `--warn` panel, alert-triangle icon,
the three-step recall (commit → run → restart), command row.

**`CMP-15-recall` — the recovery copy** (inside `CMP-15-banner`): command
`claude plugin update pandacorp@panda-corp` + the sequence text (commit if dirty → run command →
restart the Claude Code session). REQ-15-003.

The banner is mounted by the dashboard (FRD-18 composes the health banners); FRD-15 owns the
component and its data, FRD-18 places it.

## 4. Behavior / contracts

| Trigger | `reason` | Banner copy (Spanish, summarized) |
|---|---|---|
| `git status --porcelain -- plugin/` non-empty | `uncommitted` / `both` | "Plugin desincronizado — hay cambios sin commitear" + 3-step recall |
| installed SHA ≠ plugin HEAD SHA (clean tree) | `behind` | "El plugin instalado está atrás" |
| clean + SHAs equal | `in-sync` | (no banner) |
| any input unreadable | `unknown` | (no banner — never a false alarm) |

The command is **always** `claude plugin update pandacorp@panda-corp`; when `dirty`, the recall
prefixes "1) commitea los cambios". The banner never executes anything (REQ-15-005).

## 5. Traceability (`REQ-15-MMM` → AC → components)

The FRD lists acceptance criteria as bullets; IDs assigned here (`REQ-15-001..005`), one per bullet,
in order. Restated in the work orders as `AC-15-MMM.K`.

| REQ | Acceptance criterion (EARS) | Satisfied by |
|---|---|---|
| REQ-15-001 | Uncommitted changes under `plugin/` → persistent warning "uncommitted changes" | `IF-15-sync` (`readPluginDirty`, `reason`), `CMP-15-banner` |
| REQ-15-002 | Installed SHA ≠ last commit touching `plugin/` → "installed plugin is behind" | `IF-15-sync` (`readInstalledSha`, `readPluginHeadSha`, `drift`), `CMP-15-banner` |
| REQ-15-003 | Show copyable `claude plugin update …` command + the commit→run→restart sequence | `CMP-15-recall`, `CopyButton` |
| REQ-15-004 | Warning disappears on its own once back in sync | `CMP-15-banner` (poll + render-only-on-drift), `IF-15-sync` (`in-sync`) |
| REQ-15-005 | Read-only: shows the command, never executes | `IF-15-sync` (read-only git), `CMP-15-route`, architecture §7 |

All five REQ map to concrete components. No criterion is unsatisfiable on the platform.

## 6. Notes / risks

- **`installed_plugins.json` shape** can vary by Claude version; parse defensively (locate the
  `pandacorp@panda-corp` entry, read `gitCommitSha`), tolerate absence → `null`/`unknown`.
- **Short vs full SHA.** Compare by normalizing (the installed value may be abbreviated); equality is
  prefix-safe (one is a prefix of the other) — captured as an AC in WO-15-002.
- **No `simple-git` dependency** — two `execFileSync('git', …)` read-only calls are enough; avoids a
  dependency for two commands (consistent with the trimmed stack, architecture §2).
