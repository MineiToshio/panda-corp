# Feature blueprint — FRD-16 Orphan project detection (adopt?)

> **Source-of-truth hierarchy:** `FRD > FDD > design-tokens > blueprint > work order`.
> This is the **feature blueprint** (DR-049): how FRD-16 is implemented on top of the platform in
> [`docs/product/architecture.md`](../../product/architecture.md). It references the platform; it does
> not restate it.

## 1. Summary

The inverse of FRD-15's plugin drift: spot a real project in the projects folder that the factory
doesn't know about (typically a brownfield build outside the handoff) and surface a **dismissible
banner** offering to adopt it. Same shape as FRD-15: detect a gap on the server, show the command,
never act.

Two distinct gaps, two distinct nudges:
- **Orphan** (on-disk git repo, NOT in portfolio, NO `.pandacorp/status.yaml` marker) → suggest
  `/pandacorp:adopt`.
- **Registered-but-unlisted** (has the marker but is missing from `factory/portfolio.md`) → suggest
  `/pandacorp:sync-portfolio` (it is already a factory project — do NOT adopt).

The directory listing + git/fs reads need Node, so they run on the **server** behind a route handler;
the banner is a client component that polls so it **self-clears** once the project is adopted or the
owner dismisses it.

## 2. Platform references

- **Data sources** (architecture §4.2, §4.3, §4.4): `projects_path` from `factory/profile.md` (absent
  → the parent dir of the factory root, architecture §4.2); the portfolio paths from
  `factory/portfolio.md`; each candidate's `.pandacorp/status.yaml` presence as the marker.
- **`lib/orphans.ts`** (architecture §6, new): the **bounded** scan + classification. Reuses
  `lib/profile.ts` (`projects_path`) and `lib/portfolio.ts` (registered paths) — both FRD-01.
- **Read-only invariant + bounded scan** (architecture §7, FRD non-goal): immediate children only;
  excludes the factory itself and `mission-control/`; never crawls the disk; never runs `adopt`/`git`/
  writes the portfolio.
- **Surface** (architecture §11): dashboard banner + route handler `app/api/orphans/`.

## 3. Components & interfaces

### Interfaces (`lib/**`)

**`IF-16-scan` — `lib/orphans.ts`** (new module, architecture §6).

```ts
type OrphanKind = "orphan" | "unlisted";   // orphan → adopt; unlisted → sync-portfolio
type Candidate = {
  name: string;       // folder name
  path: string;       // absolute path
  kind: OrphanKind;
  hasMarker: boolean; // .pandacorp/status.yaml present
  inPortfolio: boolean;
};

resolveProjectsPath(): string;             // profile.projects_path, else parent of factory root
listProjectFolders(projectsPath): string[]; // immediate children that are git repos (.git present), excluding factory & mission-control
classifyCandidate(path, registeredPaths): Candidate | null; // null if it is a known, listed project (no nudge)
getOrphans(): Candidate[];                  // composes the above; only folders needing a nudge
```

Classification truth table (FRD "How it's detected"):

| `.git` | marker (`.pandacorp/status.yaml`) | in portfolio | → result |
|---|---|---|---|
| yes | no | no | `kind: "orphan"` (adopt) |
| yes | yes | no | `kind: "unlisted"` (sync-portfolio) |
| yes | yes | yes | not a candidate (`null`) |
| yes | no | yes | `kind: "orphan"` is FALSE — listed without marker is a portfolio/marker inconsistency; treat as **not a candidate** (already known to the factory) to avoid nagging about a registered project |
| no | — | — | not a git repo → ignored |

Defensive: unreadable `projects_path`, missing profile, broken portfolio rows → empty list, never throws.

### Route handler

**`CMP-16-route` — `app/api/orphans/route.ts`** (Server, Node runtime).
`GET` → `getOrphans()` as JSON. Needs Node for `fs.readdir` + per-folder `.git`/marker checks outside a
Server Component render (architecture §3, §8). `runtime = "nodejs"`, `dynamic = "force-dynamic"`.

### UI components

**`CMP-16-banner` — `components/orphans-banner.tsx`** (`"use client"`).
Polls `CMP-16-route`; renders one dismissible banner per candidate (or a compact stacked banner when
several). Dismissal is remembered in `localStorage` keyed by `path` (client-local UI state, like the
FRD-18 `visto_hasta` marker — NOT a factory write). Self-clears when the candidate disappears from the
probe (adopted) or is dismissed. Shows the **path** and the adopt/sync steps as copyable text via
`CopyButton` (FRD-02).

**`CMP-16-steps` — the adopt/sync recall** (inside the banner): for `orphan`, "abre una sesión en la
carpeta y corre `/pandacorp:adopt`"; for `unlisted`, "corre `/pandacorp:sync-portfolio`".

FRD-18 places this banner in the dashboard health-banner stack; FRD-16 owns the component + data.

## 4. Traceability (`REQ-16-MMM` → AC → components)

IDs assigned per FRD acceptance bullet, in order.

| REQ | Acceptance criterion (EARS) | Satisfied by |
|---|---|---|
| REQ-16-001 | Orphan present → dismissible banner "Unregistered project `<name>` — adopt?" | `IF-16-scan` (`getOrphans`, `kind:"orphan"`), `CMP-16-banner` |
| REQ-16-002 | Banner shows the **path** + steps to adopt (`/pandacorp:adopt`) as copyable text | `CMP-16-steps`, `CopyButton` |
| REQ-16-003 | Marker present but missing from portfolio → suggest `/pandacorp:sync-portfolio`, NOT adopt | `IF-16-scan` (`kind:"unlisted"`), `CMP-16-steps` |
| REQ-16-004 | Banner disappears on its own once adopted (marker + row) OR explicitly dismissed | `CMP-16-banner` (poll + `localStorage` dismiss), `IF-16-scan` |
| REQ-16-005 | Detection is read-only: never runs adopt/git, never writes the portfolio | `IF-16-scan` (fs read + `.git` existence only), `CMP-16-route`, architecture §7 |
| REQ-16-006 | Scan is bounded to immediate children of the projects folder | `IF-16-scan` (`listProjectFolders`), architecture §7 |

All REQ map to concrete components. None unsatisfiable.

## 5. Notes / risks

- **`.git` existence, not git invocation.** Detecting a repo is a cheap `fs.exists('<folder>/.git')`
  (file or dir) — no `git` subprocess needed for the scan, keeping it bounded and fast. (Contrast
  FRD-15, which does run read-only git for SHAs.)
- **Exclusions are explicit constants** (`lib/constants.ts`): the factory root and `mission-control/`
  are never offered as orphans (architecture: MC lives inside the factory).
- **Dismiss is per-path and remembered**; a re-appearing path after a real change still re-shows only
  if not dismissed — keep the localStorage key stable (the absolute path).
- **Portfolio path parsing** is reused from `lib/portfolio.ts` (FRD-01), which already tolerates broken
  rows — no duplicate parser.
