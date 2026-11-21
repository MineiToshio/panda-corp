---
id: BL-0334
type: bug
area: plugin-skill
title: "/pandacorp:upgrade has no conformance step for .codex/rules/pandacorp.rules (or a decision for e2e/hydration.spec.ts and e2e/_skip.ts), so a project silently keeps stale Codex rules and drifted e2e helpers after upgrade"
status: open
severity: p2
opened: 2026-11-21
closed:
source: "funko-tracker/personal-page-v2 overlay 9.4.2/9.2.0 -> 9.9.5 upgrade via worktree, 2026-11-21 (agent-inferred): 'the skill has no step for .codex/rules/pandacorp.rules (template gained the vercel deploy/redeploy forbidden rules, neither stage-managed-overlay.mjs nor the skill list .codex/), so a project silently keeps the old codex rules after upgrade; also e2e/hydration.spec.ts is outside the verbatim set yet drifts (ppv2 lacked the new waitForHydrated test) and e2e/_skip.ts differs only by a stale pandacorp-build.js comment. Decide whether .codex/ and hydration.spec belong to conformance.'"
closes:
links: [DR-138, DR-113, DR-120, BL-0031, BL-0302]
---

## Problem

`plugin/templates/shared/.codex/rules/pandacorp.rules` exists in the plugin's shared overlay (it carries,
among other rules, the DR-138 `vercel deploy`/`redeploy` forbidden-command rules referenced by that
decision's "Codex execpolicy forbids vercel deploy/redeploy" note). Neither `plugin/skills/upgrade/
SKILL.md` nor `plugin/scripts/stage-managed-overlay.mjs` names `.codex/` at all (confirmed by grep: zero
matches for "codex" in either file). As a result, a project upgraded from an older overlay (funko-tracker
9.4.2, personal-page-v2 9.2.0, both to 9.9.5 on 2026-11-21) keeps whatever `.codex/rules/pandacorp.rules`
it was scaffolded/adopted with, silently missing any rule added to the template since — including the
DR-138 Vercel-deploy guardrail, a production-safety rule, not a cosmetic one.

The same upgrade also surfaced a related but distinct gap: `e2e/hydration.spec.ts` sits OUTSIDE the
byte-diffed verbatim conformance set (DR-059/074/075/302's six/seven-file list), yet it still drifts —
personal-page-v2's copy lacked the newer `waitForHydrated` helper the template gained — and
`e2e/_skip.ts` differed from the template only by a stale `pandacorp-build.js` comment reference. Neither
file is in the conformance set, so `upgrade` has no mechanism to catch or fix either drift.

## Root cause

`.codex/` was added to the shared overlay templates (plugin v9.130.0, per DR-131's note) without a
matching addition to the conformance/stage-managed-overlay machinery that DR-059 established for gate
configs — the same class of gap DR-059 itself exists to prevent, but for a newer template surface that
was never wired in. `e2e/hydration.spec.ts`/`e2e/_skip.ts` were deliberately left out of the strict
byte-diff set (they are not pure gate config), but no alternative conformance mechanism (merge, diff-and-
flag, or a narrower byte-diff) was built for them either, so they can drift indefinitely once a project
diverges from the template's helper content.

## Fix plan

1. Add `.codex/rules/pandacorp.rules` (and any other `.codex/` files the shared template ships) to
   `stage-managed-overlay.mjs`'s managed-file inventory and to the project `.gitignore`/tracked-file
   allowlist as appropriate, so `upgrade` actually syncs it — following the same verbatim-propagation
   model DR-059 uses for gate configs (a project should not hand-edit `.codex/rules/pandacorp.rules`
   either, for the same reason it should not hand-edit `verify.sh`).
2. Decide `e2e/hydration.spec.ts` and `e2e/_skip.ts`'s conformance status: either add them to the
   byte-diff verbatim set (if they are meant to be identical across projects, like the other `e2e/*`
   harness files), or build an explicit merge/diff-and-flag step for them if a project is expected to
   extend them. Document the decision in `factory/standards/quality.md` or `build-orchestration.md`
   alongside the existing conformance rules.
3. Bump plugin PATCH + `OVERLAY_VERSION`; record in `plugin/docs/decision-log.md`.

## Tests (prove the fix — TDD, RED → GREEN)

A fixture project with a stale `.codex/rules/pandacorp.rules` (missing the DR-138 Vercel rules) and a
stale `e2e/hydration.spec.ts` (missing `waitForHydrated`): running `upgrade`'s conformance step today
leaves both untouched (RED); after the fix, both match the current template (GREEN), proven by the
existing `test-upgrade`/conformance suite style used for `verify.sh`/`biome.json`.

## Done when

- [ ] `.codex/rules/pandacorp.rules` is in the managed/conformance inventory and gets synced on upgrade.
- [ ] `e2e/hydration.spec.ts`/`e2e/_skip.ts`'s conformance status is decided and implemented (verbatim or
      merge), proven by a fixture test.
- [ ] Plugin + overlay versions bumped; decision-log entry.

## Out of scope

Authoring new `.codex/` rules content beyond what already exists in the template; this item is scoped to
making the existing template content actually propagate on upgrade.
