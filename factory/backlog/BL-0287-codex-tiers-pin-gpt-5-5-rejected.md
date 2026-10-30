---
id: BL-0287
type: bug
area: plugin-agent
title: "Re-map the Codex STANDARD/JUDGE tiers off gpt-5.5, which Codex now rejects for ChatGPT accounts"
status: done
severity: p1
opened: 2026-10-29
closed: 2026-10-29
source: "owner conversation 2026-10-29 (Mission Control session): live codex exec probe on codex-cli 0.163.0"
closes: "model-tiers.json Codex half re-mapped (MECH gpt-6-luna/low, STANDARD gpt-6.1-sol/low, JUDGE gpt-6.1-sol/high); .codex/agents regenerated; PORT-2, AGENTS.md rule 11, freeze-and-fidelity.md, agent notes and RuntimeComparison.tsx aligned; plugin 9.144.1; both decision logs"
links: [BL-0113, DR-113]
---

## Problem
`plugin/runtime/model-tiers.json` maps STANDARD to `gpt-5.5` (medium) and JUDGE to `gpt-5.5` (high), and the
generated `.codex/agents/*.toml` mirrors carry `model = "gpt-5.5"` for every STANDARD/JUDGE agent (18 files).
A live probe on 2026-10-29 (`codex exec -m gpt-5.5 ...`, codex-cli 0.163.0, ChatGPT login) returns HTTP 400
`"The 'gpt-5.5' model is not supported when using Codex with a ChatGPT account." (code model_not_found)`.
So every Pandacorp dispatch under Codex to a STANDARD/JUDGE agent hard-fails. The same probe shows
`gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-6-luna`, `gpt-6.1-sol` and `gpt-6-astra` all answer. Same failure class as BL-0113
(gpt-5.4 retirement), one model generation later.

## Root cause
The Codex half of the tier table still pins dated model ids that OpenAI retires on its own schedule (BL-0113's
root cause; its step 4, OpenAI-side aliases, found none).

## Fix plan
1. `plugin/runtime/model-tiers.json`: MECH → `gpt-6-luna`/low, STANDARD → `gpt-6.1-sol`/low, JUDGE → `gpt-6.1-sol`/high.
   Basis: owner-run calibration 2026-10-23 (`~/.codex/skills/orchestrate/calibration/RESULTS.md`, 55 runs):
   extraction, spec'd coding and documented review saturate for every config; on an unguided 10-bug review
   gpt-6.1-sol scores 10/10 already at low with the fewest tokens, gpt-6-astra shows no gain, xhigh only adds
   2-3x wall time, gpt-6-luna scores 6/7.5/8.5 (low/medium/high) — fine for MECH only.
2. Regenerate the mirrors: `node plugin/scripts/generate-codex-agents.mjs` (never hand-edit the TOMLs).
3. Fix the prose copies: `factory/standards/agent-portability.md` PORT-2 table, `AGENTS.md` rule 11,
   `plugin/skills/design/references/freeze-and-fidelity.md`, and Mission Control's
   `RuntimeComparison.tsx` label.
4. Plugin PATCH bump + regenerated manifests; decision-log entries.

## Tests (prove the fix — TDD, RED → GREEN)
RED (before): `codex exec -m gpt-5.5 ...` → 400 model_not_found; `grep -rn "gpt-5\.5" plugin/runtime .codex/agents factory/standards AGENTS.md` non-empty.
GREEN (after): that grep is empty; the Codex generator's drift check passes; one smoke `codex exec` with
`tier-standard.toml`'s model/effort answers.

## Done when
No rejected model id in the tier source, mirrors or prose; mirrors regenerated; plugin version bumped; both decision logs noted.

## Out of scope
The Codex `design` skill's image model (`codex-image.sh` default `gpt-5.6-sol`), which still answers.
