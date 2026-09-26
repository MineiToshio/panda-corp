---
id: BL-0191
type: bug
area: build-engine
title: "verifyPatched's BL-0178 inherited-contract matcher refuses a proven id-less contract, and the refusal lands AFTER the verifier already certified — a correct patch is 'reverted' onto itself"
status: done
severity: p1
opened: 2026-09-25
closed: 2026-09-25
source: "canary E partial run 2026-09-25 (docs/reviews/canary-e-partial-report.md §2), wf_7a12ea20-7f1, frd-03-portfolio"
closes: "plugin/templates/shared/.claude/engines/pandacorp-build.js — verifyPatched split into verify (writes nothing) → engine checks (WP-08 cage + unresolvedInherited) → certifyPatched (serialized certify-patch stamp); inherited contracts keyed INH-n — shipped in c76299d0"
links: [BL-0178, BL-0190, DR-122, DR-073, DR-107]
---

## Problem
In canary E the FRD-03 gate reopened WO-03-006 with 3 open fails: REQ-03-007, AC-03-007.2 and an **id-less**
`error`-class contract ("Error — unparseable last sync SHALL show an explicit invalid-date chip…"). The patch
greened. `verify-patch:frd-03-portfolio` returned `green:true` with all three inherited contracts `pass:true`, each
with its tests. The engine then logged
`⛔ … 1 inherited fail contract(s) are not proven closed (Error — unparseable last sync …) — REFUSING to certify
(BL-0178)` and ran `revertAndReopen`.

By then the verifier had already, as its prompt instructs:
- committed `implementation_status: VERIFIED`, `frd_end` and `review_end verdict:"pass"` (21:58:38Z),
- set `last_green_sha: a824bf2f` (the commit containing the patch),
- published the snapshot `1acb4fee`.

So `revert` found nothing to check out ("the rebuild starts from the same WO-03-006 code the gate just rejected").
The DR-107 "in-run retry from the clean base" (`build:WO-03-006`, opus) produced `f4824d69`, which touches only the
WO doc and no `src/`. The re-gate had already launched when the usage limit cut the run.

Measured waste: 1.28 $ and 4.1 min (revert + build + commit), plus the re-gate (≈ 2.5 $ and 10 min, D2-equivalent).

## Root cause
Two defects compound.

1. **Matcher false negative** (`plugin/templates/shared/.claude/engines/pandacorp-build.js:2818-2826`). The prompt
   lists each inherited contract as `• [<class>] <contract> — the gate's tests: <files>` (`:2796`) and asks for
   `contract: <its text VERBATIM as listed>`. The engine accepts only
   `norm(r.contract) === norm(e.contract)` or equal `contractIdOf()` (`/\b(?:REQ|AC)-\d+-\d+…/`). A contract without a
   REQ/AC id can match only exactly, and the class tag plus tests suffix that the prompt itself adds make an exact echo
   impossible by construction. The verifier echoed `error: Error — … — the gate's tests: …`.
   Invariant/edge-case/limit/error/exclusion rows are routinely id-less, so this is not a one-off.
   Reproduced offline: replaying the matcher over journal #17 (gate traceability) and #34 (`inheritedResolved`) gives
   `OPEN: [the error contract]`.
2. **Refusal after side effects** (`:2807-2830` together with `gateConverge` `:3348-3351` and `revertAndReopen`
   `:2846`). The certifier writes VERIFIED, `last_green_sha`, `review_end pass`, `frd_end` and the publication
   *before* the engine validates `inheritedResolved` (and before the WP-08 partial-report cage). A downgrade-to-red
   then takes the "genuine red" path without compensating for them: `last_green_sha` still points at the refused
   code, `revert` checks out that same sha, and the "clean base" retry is not clean. For a **real** refusal this
   would leave rejected code published as last green and never discard it (the BL-0190 violation class).

## Fix plan
1. Key the inherited contracts. Number them in the prompt (`INH-1…INH-n`) and add a required `key` to the
   `inheritedResolved` schema items. Match by `key` first. As a fallback, strip a leading `[class]`/`class:` tag and
   a trailing ` — the gate's tests: …` suffix before `norm` equality. Keep the REQ/AC id match.
2. Validate before side effects. Split verify-patch: the verifier returns `{ green, inheritedResolved,
   report_scope }` and writes nothing. The engine runs the partial-report cage and the BL-0178 check. Only then does a
   MECH certify step (or the same agent, resumed) stamp VERIFIED, `last_green_sha`, `review_end pass`, `frd_end` and
   publish.
   Minimum alternative if the split is too large: snapshot `last_green_sha` before the patch ladder. On a
   post-certification downgrade, hand `revertAndReopen` that explicit base, have COMMIT 1 restore it, and emit a
   compensating `review_end reopen`.
3. Apply the same ordering to `repairGateTest`'s second `verifyPatched` call (`:3357`).

## Tests (prove the fix — TDD, RED → GREEN)
Add scenarios to `plugin/scripts/test-pandacorp-build.mjs`, modeled on the BL-0178 T1 harness (`b178Plan`/`b178Trace`):
- **T-idless**: the gate fails an id-less `contractClass:'error'` row. `verify-patch` answers
  `inheritedResolved:[{ contract: 'error: <text> — the gate\'s tests: t.test.ts', pass:true, tests:['t.test.ts'] }]`.
  Expect `builtFrds` to include the FRD, no `revert:` label, and no `⛔ … REFUSING` log. This is RED today.
- **T-genuine-refusal**: an inherited contract with `pass:false`. Expect no VERIFIED/`last_green_sha` stamp in the
  verify prompt path before the refusal, `revert:` receiving the pre-ladder base sha, and a compensating
  `review_end reopen`.

## Done when
- [x] Both scenarios are RED → GREEN, and the full engine harness is green (`test-pandacorp-build.mjs` 274/274,
  `run-engine-tests.sh` 27/27 suites, c76299d0).
- [ ] A canary E relaunch shows FRD-03 landing VERIFIED on its first verify-patch. **Not verified** — needs the relaunch.

## Resolution
Shipped in c76299d0 (both halves of the fix plan, the full split — not the "minimum alternative"):
- **Matcher.** Each inherited contract is listed as `• [<class>] <contract> — the gate's tests: … · key INH-<n>`; the
  schema gained an optional `key`. `unresolvedInherited()` matches by that key, by REQ/AC id, or by the contract text
  with the prompt's own decoration stripped from both sides (bullet, key, `[class]`/`class:` tag, tests suffix,
  dash/quote variants, whitespace, case). An entry still proves a contract only with `pass:true` and ≥1 test.
- **Order.** The `verify-patch` agent writes nothing and returns `{ green, inheritedResolved, report_scope, resolved }`.
  The engine runs the WP-08 partial cage and the BL-0178 check; only an accepted verdict spawns `certify-patch:<frd>`
  (MECH, serialized on commitChain like `applyGate`), which stamps VERIFIED + reopen_count 0, rollups, drift replica,
  reviewer-test staging, the last-green ordering, the resolution journal line, review_end/GateVerdict pass, PatchResult
  green and achievements. Every `verifyPatched` caller (patch-1, gate-test repair, diagnosed repair, deadlock re-bless,
  patch-2) inherits the order. A certify step that does not confirm returns `unstamped` → the FRD is deferred
  (re-gates next pass) and the verified code is never reverted.
- **Tests** (`test-pandacorp-build.mjs`, `// ---- BL-0191..0193 ----`): BL-0191a (the canary echo), b (`[class]` +
  en-dash + key suffix next to an id-keyed REQ), c (key only), d/e/f (genuine refusals — different contract,
  `pass:false`, no test — with no stamping spawn between the gate and the revert), g (certify step after the verifier,
  carrying the full stamp), h (partial report refused before any certify), i (certify failure → no revert, deferred).
  BL-0178 T6 and BL-0185c now assert the drift replica on the certify step.

## Out of scope
Changing what counts as "proven closed" (still ≥1 passing test per inherited contract). BL-0190's post-run audit
stays a separate item.
