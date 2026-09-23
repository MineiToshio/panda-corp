---
id: BL-0140
type: bug
area: build-engine
title: "classify-change.sh's S5 auth floor misses a real ownership-equality guard written with no auth vocabulary and no auth-path file"
status: done
severity: p1
opened: 2026-09-22
closed: 2026-09-23
source: "docs/proposals/37-fast-change-path-and-implement-cost.md speed sprint, independent review round 2, case REV2-C (plugin/scripts/test-classify-change.sh)"
closes: "plugin/scripts/classify-change.mjs S5 (OWNERSHIP_GUARD / S5_STRUCTURAL_JOINED)"
links: []
---

## Problem
`classify-change.sh`'s S5 signal (the authorization/auth floor) only fires on two things: **auth
vocabulary** (identifiers/strings matching `auth`, `permission`, `role`, `authorize`, …) and **auth-path
files** (middleware/guard-shaped paths). A genuine authorization DECISION can be written with neither: the
round-2 independent review's case **REV2-C** stages this diff against a fresh lib file with no other floor
signal present —

```ts
export function pick(ctx: { u: { id: string } }, row: { o: string; body: string }) {
  if (ctx.u.id !== row.o) return null;
  return row.body;
}
```

— a plain ownership-equality guard (only the requester whose id matches the row's owner gets the body
back) using generic identifiers (`u`, `o`, `ctx`, `row`) that trip neither S5's vocabulary list nor its
path list. `classify-change.sh --staged` on this diff returns `rigor: "normal"`, not `critical`: a change
that silently drops or weakens an ownership check would be classified at the SAME rigor as an ordinary
47-line refactor, and would NOT get the critical-path review depth (adversarial tests, wider reviewer
scrutiny) that a real auth change is supposed to guarantee. This is currently shipped as a **documented,
non-blocking XFAIL** in `plugin/scripts/test-classify-change.sh` (case `REV2-C`, via the `xf()` helper) so
the suite stays green without masking the gap — it must not be silently "fixed" by deleting or softening
that test; the test should flip to `expect_rigor critical` only once a real detector exists and this item
is closed.

## Root cause
S5 is a **lexical** signal (vocabulary + path matching over the diff text), not a **structural** one. It
has no notion of "this is an equality comparison between two field accesses on different objects, gating a
return value" — the shape that makes `ctx.u.id !== row.o` an authorization check regardless of what the
identifiers are named. Building that requires either a lightweight AST-level pattern (an `if` whose
condition is a `!==`/`===` comparison between two member-expressions, immediately followed by an early
`return`/`throw`, over code that reads a stored/request-scoped identity value) or a reverse-dependency
signal (S17, currently gated on `madge` being available) that would catch the SAME diff by a different
route: if the touched function is transitively imported by something the floor already recognizes as
sensitive (a route handler, a query module), S17 should independently escalate it once madge is a
mandatory dependency of this repo rather than an optional one.

## Fix plan
1. **Design the structural heuristic before writing it.** Do not ship a regex guess; false positives here
   are expensive (every plain equality check in the codebase would falsely floor to critical). Draft the
   AST-shape pattern (Node's own `acorn`/`typescript` parser, already a devDependency path used elsewhere
   in `plugin/scripts/`, or a conservative regex fallback if a parser dependency is rejected) and backtest
   it against the full existing REV2 backtest corpus (`test-classify-change.sh` cases 22-27, REV2-A/A2/B)
   PLUS a new negative corpus of ordinary equality checks (list filtering, string comparison, enum
   switches) that must NOT trip it, before wiring it into `classify-change.sh`.
2. **Make S17 (madge reverse-dependency floor) mandatory once available**, per the note this item's
   `source` sprint already left in the S17 floor-on-missing-madge fix (`af5d6bf2`): today S17 only runs
   when `madge` is present, and floors to `normal` (not `critical`) when it's missing. A repo where madge
   is a first-class dependency should not get a softer floor than one where it's absent — audit
   `classify-change.sh`'s S17 branch and make its floor-on-missing case match this item's severity once
   the heuristic in step 1 exists (they compound: structural pattern for local shape, S17 for blast
   radius).
3. Touch only `plugin/scripts/classify-change.sh` (new S-signal or extend S5) and
   `plugin/scripts/test-classify-change.sh` (flip `REV2-C`'s `xf(...)` call back to
   `expect_rigor critical "REV2-C: ..."`, keep the new negative-corpus cases alongside it).

## Tests (prove the fix — TDD, RED → GREEN)
RED = today: `test-classify-change.sh` case `REV2-C` is `xf`-recorded as a known gap (`rigor: normal`
instead of `critical`) — run `bash plugin/scripts/test-classify-change.sh` and see the `xfail` line.
GREEN = case `REV2-C` flipped to `expect_rigor critical` and passing, AND the new negative corpus (plain
equality checks that are NOT ownership guards: `if (status !== "done") return`, `if (a.id === b.id)` list
dedup, enum switches) still classifies at `normal`/whatever it would without the new signal — proving the
heuristic doesn't over-fire. Control: cases 22-27 and REV2-A/A2/B must remain green (no regression in the
existing floor signals).

## Done when
- [x] `classify-change.mjs` detects the REV2-C shape as `critical`: a new S5 structural signal
      (`OWNERSHIP_GUARD` / `S5_STRUCTURAL_JOINED`) matches a `!==` comparison between two MEMBER
      EXPRESSIONS immediately guarding an early `return`/`throw`, scanned over each file's added
      lines joined (reuses `codeAddedJoinedByFile`, the REV2-A machinery). `===` is deliberately
      excluded (it denies on match, the shape of an ordinary equality/dedup check, not a
      denial-on-mismatch guard) — chosen and backtested over the S17-mandatory-madge route because
      it directly closes the REV2-C diff shape without depending on an optional tool.
- [x] `test-classify-change.sh` case `REV2-C` flipped from `xf(...)` to `expect_rigor critical`, green.
- [x] Negative corpus added and green: `REV2-C-neg1` (bare-identifier inequality, `if (status !==
      "done") return`), `REV2-C-neg2` (`===` list-dedup, `if (a.id === b.id)`), `REV2-C-neg3`
      (enum-style `switch`) — none hit the S5 floor, proving the heuristic doesn't over-fire.
- [x] No regression: cases 22-27 and REV2-A/A2/B remain green. `bash plugin/scripts/test-classify-change.sh`
      isolated to this item's diff — 99 passed / 0 failed / 0 xfail (was 91 passed / 0 failed / 1 xfail).
- [x] `bash plugin/scripts/run-engine-tests.sh` — 24/24 suites green.
- [ ] `plugin/docs/decision-log.md` entry and the plugin version bump (DR-034) — deliberately NOT
      done by this item: implemented under an explicit operator instruction not to touch
      `plugin/docs/decision-log.md`, `plugin/runtime/plugin-metadata.json` or the generated
      manifests in this session; a separate closure pass owns that step.
- [x] Fixed in commit `abdf50a8` on branch `bl-0140-0134-classifier`.
- [ ] S17-mandatory-madge-floor (fix plan step 2) — out of scope for THIS item's closure; the
      structural signal alone closes REV2-C. Left as a follow-up if a future backtest finds a case
      the structural heuristic still misses but blast-radius (S17) would have caught.

## Out of scope
Rewriting S5's existing vocabulary/path matching (still correct and complementary) or building a full
AST-based rewrite of `classify-change.sh` — this item adds ONE new structural signal (or extends S17's
mandatory-madge floor), it does not redesign the classifier.
