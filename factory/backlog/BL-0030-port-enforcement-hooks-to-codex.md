---
id: BL-0030
type: change
area: hooks
title: "Port the enforcement hooks (dangerous-command gate, verify-before-stop) to Codex hooks"
status: open
severity: p0
opened: 2026-07-04
closed:
source: "Codex independent verification of proposal 25 (2026-07-04), findings 4 — docs/proposals/25-codex-verification-handoff.md block D1"
closes:
links: [DR-113, DR-120]
---

## Problem
> **RAISED TO p0 BY DR-120 (2026-09-02) — this item is the MECHANISM of the Codex freeze, not a victim of it.** The owner froze every non-Claude runtime at read/review-only. Today that property is prose in `AGENTS.md`/PORT-5 against `plugin/runtime/enforcement-policy.json:11`'s `sandbox_mode: "workspace-write"` — the same configuration that preceded the BL-0035 data-loss incident. Under the freeze the port's job narrows and sharpens: make read-only *enforced* (deny writes to build state and to `.pandacorp/` from a Codex session), not enable anything. Do NOT scope this as "hooks parity for a future Codex build".

Under Codex the factory's safety rules are instructions, not enforcement (agent-portability.md PORT-6). Codex HAS a hooks system (`SessionStart/PreToolUse/PostToolUse/Stop`, JSON stdin/stdout, deny via exit 2 — https://developers.openai.com/codex/hooks) and its plugin hooks even export `CLAUDE_PLUGIN_ROOT` compat aliases, so the port is feasible. The Codex verification session confirmed feasibility but flagged two concrete mismatches that make a naive port wrong:
1. Codex's file-edit tool is `apply_patch`, not `Write|Edit` — our PreToolUse matchers (`warn-adhoc-write.sh`, `remind-manual-sync.sh`) would never fire as configured.
2. `verify-before-stop.sh` keys its build-active bypass on `.pandacorp/run/build.lock` freshness (DR-063), while the portable attended loop (PORT-5) only maintains `running` + `supervisor_heartbeat` in `status.yaml` — under Codex the Stop gate would run strict when it should stand aside, or vice versa.

## Fix plan
1. Add a Codex hooks registration (`.codex/hooks.json` or `[hooks]` tables) mapping our existing scripts: `block-dangerous.sh` → PreToolUse on shell tool; write-gate reminders → PreToolUse on `apply_patch` (payload field mapping needed — the scripts read Claude's `tool_input` shape); `verify-before-stop.sh` + `capture-lessons-reminder.sh` → Stop.
2. Make the scripts tolerate both payload shapes (Claude hook JSON vs Codex hook JSON) — detect by `hook_event_name`/field presence; share ONE script, never fork copies.
3. Reconcile the build-active signal: either the attended loop (PORT-5 playbook step 2) also touches `.pandacorp/run/build.lock`, or `verify-before-stop.sh` learns to read `status.yaml` heartbeat as an alternative freshness source. Pick one and document in agent-portability.md.
4. Verify hook trust flow (`--dangerously-bypass-hook-trust` NOT used; persist trust properly).

## Proof
- A Codex session in a factory project attempts `rm -rf` → blocked by the hook.
- A Codex session ending with a red `verify.sh` and no fresh build signal → Stop gate output shown.
- Same scripts still pass under Claude Code (no regression in plugin hooks).
