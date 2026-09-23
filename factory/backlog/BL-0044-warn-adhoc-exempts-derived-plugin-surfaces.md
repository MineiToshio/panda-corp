---
id: BL-0044
type: bug
area: hooks
title: "warn-adhoc-write.sh exempts plugin/agents + manifest edits from the isolation nudge, yet their uncommitted edits red the drift gate"
status: done
severity: p2
opened: 2026-07-05
closed: 2026-09-23
source: "Fable hardening sprint II WS-A adversarial guard-bypass hunt (docs/proposals/28), finding F10"
closes:
links: [BL-0033, DR-096, DR-113]
---

## Problem
The isolation nudge (`plugin/scripts/warn-adhoc-write.sh`) was scoped by BL-0033 to skip
factory-only prose. But the catch-all skip case (`*/plugin/*|…|*.md`) also exempts two surfaces
that are DERIVED/GATED, not inert prose:

- `plugin/agents/*.md` — the Codex TOML mirrors regenerate from these; an uncommitted agent-def edit
  in the shared main checkout reds another session's Stop drift gate (`check-derived-drift.sh`).
- `plugin/.claude-plugin/plugin.json` (+ `.codex-plugin/plugin.json`) — the manifest versions the
  drift gate checks for sync.

So exactly the cross-session-red risk BL-0033's nudge exists to prevent is silently exempted for
these two. Evidence (WS-A F10 executed matrix): editing `plugin/agents/reviewer.md` or the manifest
in the shared checkout produced NO nudge.

## Root cause
The `*/plugin/*` and `*.md` skip patterns are evaluated before any carve-out for the derived
surfaces, so they swallow `plugin/agents/*.md` and the manifests.

## Fix plan
Add a keep-nudge case BEFORE the `*/plugin/*` skip in the `skip_isolation` `case` (line ~73):
`*/plugin/agents/*|*/plugin/.claude-plugin/*|*/plugin/.codex-plugin/*) : ;;` — so these three keep
the isolation nudge while genuine factory prose (`factory/**`, `docs/**`, other `plugin/**/*.md`)
stays exempt.

## Tests (prove the fix — TDD, RED → GREEN)
Extend `plugin/scripts/test-warn-adhoc-write.sh`: `plugin/agents/reviewer.md` → nudge;
`plugin/.claude-plugin/plugin.json` → nudge; control `factory/standards/quality.md` → still NO
nudge; control `plugin/skills/foo/SKILL.md` → still NO nudge.

## Done when
The three derived surfaces nudge, the prose controls stay silent, canaries prove both, plugin
version bumped.

## Out of scope
Whether `plugin/agents` prose "should" always nudge in principle — this item fixes only the
derived-layer red risk BL-0033 already accepted as the nudge's purpose.

## Progress note (2026-09-22) — status moved open → doing, NOT closed
Speed-sprint package **E3** (branch `e3-stop-hook-fastpath`, commit **c3854e3f** "perf(hooks): fast-path
the Stop-gate verify and derived-drift checks (BL-0044)", merged into `integration-speed-sprint-a` at
`b45b4a04`) landed under this item's id, but it is a **different, adjacent fix, not this item's fix plan**.
Read closely (`plugin/scripts/check-derived-drift.sh` on that branch, `test-check-derived-drift.sh`
scenarios 9-10):

- **What E3 actually did:** gave `check-derived-drift.sh` (and `verify-before-stop.sh`) a session-scoped
  fast path that SKIPS the expensive generator re-runs on Stop when (a) THIS session's own `.touched` set
  has nothing under `plugin/`/`factory/`, (b) `git status` has nothing dirty under `plugin/`, and (c) HEAD
  matches the last recorded clean sha. This narrows how often the Stop hook pays the heavy check at all —
  a cost/latency win — and is verified by its own harness (`test-check-derived-drift.sh` scenario "BL-0044
  MC-only touched session -> fast-path, no node runs" vs "BL-0044 plugin/ touched session -> full check
  runs, node invoked").
- **What E3 did NOT do:** touch `plugin/scripts/warn-adhoc-write.sh` at all. Confirmed live
  (`git show c3854e3f -- plugin/scripts/warn-adhoc-write.sh` on the panda-corp repo is empty, and
  `skip_isolation`'s `case` on `e3-stop-hook-fastpath` still reads
  `*/plugin/scripts/*|*/plugin/hooks/*|*/plugin/templates/*|*/mission-control/*) : ;;` for the keep-nudge
  list, then `*/factory/*|*/docs/*|*/plugin/*|*/.claude/*|*.md|*.base|*/ideas.base) skip_isolation=1 ;;` —
  `plugin/agents/*.md` and the two manifests still fall through to the exempt branch). So this item's ROOT
  DEFECT — an agent editing `plugin/agents/reviewer.md` or a manifest in the shared checkout still gets NO
  isolation nudge — is unchanged. And because E3's fast path requires "nothing dirty under `plugin/`" to
  trigger, it does NOT even mask the symptom: the exact scenario this item describes (an uncommitted
  `plugin/agents/*.md` edit sitting in the shared checkout) leaves that path dirty, which disqualifies the
  fast path and forces the SAME full drift check the original bug report was about — E3's own control
  scenario ("plugin/ touched session -> full check runs, node invoked") demonstrates this directly.
- **Why `status: doing` and not `open`:** real, verified engineering effort landed against this id this
  sprint (the fast path is a genuine adjacent improvement to the same hook family, and its test scenarios
  are E3's, not fabricated), so leaving it at `open` with no trace would undersell it. But the Fix plan
  above — the `skip_isolation` case addition in `warn-adhoc-write.sh` — is entirely unstarted; do not treat
  this item as closeable until that lands.

## Remaining work (unchanged from the original Fix plan)
Add the keep-nudge case to `plugin/scripts/warn-adhoc-write.sh`'s `skip_isolation` `case` BEFORE the
catch-all `*/plugin/*` skip: `*/plugin/agents/*|*/plugin/.claude-plugin/*|*/plugin/.codex-plugin/*) : ;;`.
Extend `plugin/scripts/test-warn-adhoc-write.sh` per the Tests section above. Only then does "Done when"
apply and this item move to `done`.

## Resolution (2026-09-23)
Landed the remaining work above, on branch `bl-0044-warn-adhoc` in worktree `panda-corp-bl-0044`, with
one deliberate deviation from the literal Fix plan: instead of hand-duplicating the three derived
globs (`*/plugin/agents/*|*/plugin/.claude-plugin/*|*/plugin/.codex-plugin/*`) as a second, independent
copy of "which surfaces are derived", `warn-adhoc-write.sh` now reads that list at run time from
`plugin/runtime/source-graph.json` — the SAME single source of truth `check-runtime-sources.mjs`
already verifies every generated projection against (DR-115: one writer per fact, everyone else
derives). A hardcoded literal list would itself become a second, driftable copy the moment a new
derived surface is added to the source graph; reading the graph means the nudge coverage stays correct
by construction.

- `plugin/scripts/warn-adhoc-write.sh:68-91` — new `is_derived_plugin_surface()` reads
  `plugin/runtime/source-graph.json`'s `outputs` (exact full-path match) and `source_glob` (directory-
  level match, only used by `plugin/agents/*.md` today) and short-circuits the prose exemption for any
  match, before the existing `*/factory/*|*/docs/*|*/plugin/*|...` skip case runs.
- Matching is exact-path for `outputs`, not directory-prefix, because one real output —
  `factory/gamification-ledger.json` — lives inside `factory/`, which is otherwise legitimate
  hand-authored prose (`factory/standards/*.md`, `factory/decisions/registry.yaml`); a naive
  directory-prefix match on every output's dirname was tried first and confirmed live to wrongly
  swallow ALL of `factory/**` back into the "no nudge" branch — caught before landing by testing the
  generic derivation against the real `plugin/runtime/source-graph.json` (`jq` dirname query), not
  assumed safe.
- Fails open: no `plugin/runtime/source-graph.json`, or no `jq` on PATH, and the function returns
  false — the file falls through to the existing (pre-fix) prose/gated logic unchanged, never a crash
  and never a wrongly-suppressed nudge on a genuinely gated path (those were already covered by the
  pre-existing `*/plugin/scripts/*|*/plugin/hooks/*|*/plugin/templates/*|*/mission-control/*` case).
- `plugin/scripts/test-warn-adhoc-write.sh` — extended the factory fixture with a
  `plugin/runtime/source-graph.json` shaped like the real one (`plugin_identity` outputs =both
  manifests, `shared_agents` source_glob = `plugin/agents/*.md`, plus
  `durable_gamification_accounting` output = `factory/gamification-ledger.json` to exercise the
  exact-match-not-directory-match guard) and added: `plugin/agents/reviewer.md` → nudge,
  `plugin/.claude-plugin/plugin.json` → nudge, `plugin/.codex-plugin/plugin.json` → nudge (the BL's
  third derived surface, not explicitly listed in the original Tests section but named in the Fix
  plan's `case` pattern and in Problem), `factory/gamification-ledger.json` → nudge (collision guard),
  `plugin/runtime/plugin-metadata.json` (a legitimate hand-edited SOURCE, not an output) → still NO
  derived-surface nudge, and a fail-open control with no `source-graph.json` present at all → still NO
  nudge on unrelated prose. Confirmed RED against the pre-fix script (4 of the new assertions failed:
  the three derived-surface nudges plus the ledger collision guard — exactly the surfaces this item
  names), GREEN after the fix (19/19). `plugin/scripts/run-engine-tests.sh` run twice: first run 24/25
  (an unrelated, non-reproducing `test-codex-executor.mjs` failure — confirmed pre-existing/flaky by
  running that suite standalone on `main`, 51/51 green there, and by a second concurrent
  `run-engine-tests.sh` invocation from a parallel worktree session observed running at the same
  wall-clock time, consistent with `factory-process-audit`'s documented "parallel sessions are normal"
  contention rather than a regression from this change); second run 25/25 clean.
- `plugin/scripts/run-engine-tests.sh` — registered `test-warn-adhoc-write.sh` in
  `EXPLICIT_SH_SUITES` (it existed but was never wired into the aggregate runner or CI).
- `plugin/scripts/validate-backlog.sh` and `plugin/scripts/check-derived-drift.sh` both clean (no
  drift; nothing in this change touches a generated projection).
- Not done here, by explicit instruction (a separate closing agent owns it): the plugin version bump
  in `plugin/runtime/plugin-metadata.json`, manifest regeneration, and the
  `plugin/docs/decision-log.md` entry (CLAUDE.md §Plugin maintenance).
