# WO-01-004 review — `readPortfolio` (markdown table parse)

**Reviewer:** Opus 4.8 (DR-015, different model from the implementer)
**Date:** 2026-06-16
**Module:** `lib/portfolio.ts` · IDs: `CMP-01-portfolio`, `IF-01-readPortfolio`, REQ-01-004, AC-01-004.1; consumed by FRD-03.

## Verdict: APPROVED

The data module meets its contract; its tests are not decorative (they kill mutants).
The two blocking-looking items below are **out of WO-01-004's scope** and tracked as such.

## Evidence re-run from clean (not trusting the self-report)

| Gate | Command | Result |
|---|---|---|
| Lint (module) | `pnpm biome check lib/portfolio.ts lib/portfolio.test.ts` | exit 0 |
| Typecheck (whole project) | `pnpm tsc --noEmit` | exit 0 |
| Tests (module) | `pnpm vitest run lib/portfolio.test.ts` | 49/49 (60/60 with the adversarial suite) |
| Full gate | `bash .pandacorp/verify.sh` | **exit 1** — see note |

**verify.sh red is NOT from this WO.** The 3 biome errors are all in
`app/projects/[slug]/_party/event-vm.ts` + `event-vm.test.ts` (organizeImports,
noUnusedImports, noUnusedVariables). That whole `app/projects/` tree is **untracked**
(`git status` → `?? app/projects/`) — it is another WO's in-flight work, committed by
nobody. WO-01-004 landed at `dd6604e` (data module) + `1a7bff2` (UI) and is biome-clean
in isolation. The reviewer fails-closed on the global gate as a fact, but the cause is
environmental contamination, not WO-01-004. **The orchestrator must clean/commit the
event-vm work (or fix its 3 lint errors) before the build's global gate goes green again.**

## Adversarial tests added (DR-015)

`lib/portfolio.adversarial.test.ts` — 11 tests on parser failure modes the implementer's
49-test suite did not cover. Every expectation was pre-confirmed against the real parser
via a throwaway probe before being asserted (so they pin real behavior, not wishes):

- **CRLF** line endings → no stray `\r` in any cell (incl. the last, most-exposed cell).
- **Indented** (leading-whitespace) table still parses.
- **Extra trailing cells** (row wider than header) → ignored, no leak, no throw.
- **Duplicate `Path` header** → positional path wins, duplicate cannot clobber it.
- **Missing `|---|` separator** → data rows still parse (tolerance > strict GFM).
- **Data row literally named `name`** → documents the header-collision drop (known limit).
- **GFM escaped pipe `\|`** → documents the column-shift gap (see Important below).
- **Untrusted cell content** (`../../etc/passwd`, `<script>`) → returned verbatim, inert, no throw, no traversal.
- **Whitespace-only name / path** → row dropped (required-field guard).
- **Directory path** (`/tmp`, EISDIR) → fails soft to `[]` (different errno from "missing file").

All 11 pass.

## Mutation check (DR-016)

Mutated `lib/portfolio.ts` (restored after each):

| Mutant | Result |
|---|---|
| placeholder normalization removed | KILLED |
| name-required guard removed | KILLED |
| path index off-by-one (`cells[2]`) | KILLED |
| **all** cell-trim layers removed | KILLED (CRLF adversarial test fails first) |
| single trim removed (normalizeCell only / splitTableRow only / loop `i=1`) | survived — **equivalent mutants**: trimming is layered (splitTableRow + normalizeCell + direct name/path `.trim()`), and `i=1` hits the `key === "path"` skip, so a single-point removal is inert. The full-trim-removal mutant confirms the trim behavior IS pinned. |

Tests kill real mutants; survivors are equivalent (redundant defense), not test gaps.
`lib/portfolio.ts` left byte-identical to HEAD (`git diff lib/portfolio.ts` empty).

## Findings

**Blocking:** none against WO-01-004.

**Important (non-blocking — tracked, not in this WO's contract):**

1. **GFM escaped pipe not honored** — `lib/portfolio.ts:80-86` (`splitTableRow`) splits naively
   on `|`, so a cell containing an escaped pipe (`\|`, valid GFM) shifts all subsequent
   columns. A repo URL or origin idea with a `|` corrupts the optional columns of that row.
   *AC-01-004.1 itself still holds* (name + path survive — confirmed by the adversarial test),
   so it does not block this WO. Suggested fix if it ever bites: split on `/(?<!\\)\|/` then
   `replace(/\\\|/g, "|")` per cell. Worth a one-line note in the blueprint as a known limit.

2. **verify.sh global gate is red** — caused by uncommitted `app/projects/[slug]/_party/event-vm.*`
   (3 biome errors), *not* WO-01-004. Must be resolved by the orchestrator/other WO before the
   build is declared green; flagged here so it is not silently inherited.

**Minor (non-blocking):**

- **Header detection by `firstCell === "name"`** — `lib/portfolio.ts:134-135` treats any row
  whose first cell is `name` (case-insensitive) as a header and drops it (+ rebuilds the column
  map). A project literally named `name` would vanish. Implausible in practice; pinned by an
  adversarial test so a future refactor changes it consciously.

## Lens summary

- **Correctness:** AC-01-004.1 met — reads `factory/portfolio.md`, returns name+path per row,
  maps optional columns by header name (order-tolerant), normalizes `—`/`-`/`""` → `undefined`,
  preserves the broken path verbatim (REQ-01-010), missing/empty/no-table file → `[]`, never
  throws. Edge handling is robust (CRLF, indentation, extra cells, whitespace, EISDIR).
- **Security:** read-only (`fs.readFileSync` only — no writes, no egress, no Claude). Untrusted
  cell content is returned inert; no eval, no path stat, no injection surface. No new dependencies.
- **Quality:** scope contained to the WO module + its test; the `PortfolioEntry` type matches the
  contract; no duplication or scope creep. (The UI commit `1a7bff2` is a separate concern; this
  review is of the data module.)
