---
id: BL-0113
type: bug
area: plugin-agent
title: "The Codex MECH tier pins gpt-5.4-mini, retired from Codex on 2026-08-31 — a dispatch would hard-fail"
status: open
severity: p1
opened: 2026-09-02
closed:
source: "docs/proposals/33-model-era-audit.md §6 R-01 + R-74 + R-07 (owner decision §12.1 gates it)"
closes:
links: [DR-120]
---

## Problem
> **DR-120 (Codex freeze, 2026-09-02) does NOT close this item.** The owner froze Codex at read/review-only, but the `.codex/agents/*.toml` mirrors are still generated and still drift-gated, and a MECH-tier dispatch for a *read/review* task would hard-fail on a retired id exactly as a build dispatch would. Fix it; just do not treat it as Codex capability work.
>
> **Replacement mapping (source: https://learn.chatgpt.com/docs/models, accessed 2026-09-02, re-verified by the orchestrator):** *"GPT-5.4 and GPT-5.4 mini retire from Codex on August 31, 2026; replace `gpt-5.4` with `gpt-5.6-terra` and `gpt-5.4-mini` with `gpt-5.6-luna`."* So MECH -> `gpt-5.6-luna`. Step 3 below (the STANDARD/JUDGE cost inversion against `gpt-5.6-terra`/`gpt-5.6-sol`) still stands and must be decided explicitly, not inherited.

`gpt-5.4` and `gpt-5.4-mini` were retired from Codex on **2026-08-31**, two days before the audit. Live pins
verified 2026-09-02: `plugin/runtime/model-tiers.json:5` `"codex": { "model": "gpt-5.4-mini", "effort":
"low" }`; `.codex/agents/tier-mech.toml:3` `model = "gpt-5.4-mini"` (generated — it follows the JSON);
`factory/standards/agent-portability.md:44` in prose; `AGENTS.md:89` in prose; plus Mission Control's
`RuntimeComparison.tsx:91` diagram. A dispatch to a retired id hard-fails, blocking any Codex use.
`docs/proposals/30-factory-contradiction-sweep.md:108` already recorded `AGENTS.md:89` as finding **N3
"confirmed"** on 2026-07-05 — and it is still wrong, which makes this a second data point that the
factory's detection works and its closing does not. The Claude half of the same table absorbed the entire
4.x→5 transition with **zero edits** because it pins aliases (`model-tiers.json:4,8,12`) — that is the
exemplar this fix should copy.

## Root cause
The Codex half of the tier table pins dated model ids where the Claude half pins aliases.

## Fix plan
1. Re-map MECH → `gpt-5.6-luna` in `plugin/runtime/model-tiers.json` (the single source — the generator
   `plugin/scripts/generate-codex-agents.mjs:109-113` builds the TOML map from it), then regenerate the
   mirrors with `node plugin/scripts/generate-codex-agents.mjs`.
2. Fix the two prose copies (`agent-portability.md:44`, `AGENTS.md:89`) and the MC diagram — closing N3.
   While at `agent-portability.md:44`, fix R-07: PORT-2 says Codex MECH effort is "minimal/low"; the
   generator only ever emits `"low"`.
3. **Note, do not silently keep:** STANDARD/JUDGE → `gpt-5.5` ($0.88/call-unit) is **cost-inverted** against
   `gpt-5.6-sol` ($0.624) and `gpt-5.6-terra` ($0.352). Record the choice explicitly.
4. Check whether OpenAI-side aliases exist, so the Codex half can stop pinning dated ids at all.

## Tests (prove the fix — TDD, RED → GREEN)
`grep -rn "gpt-5\.4" AGENTS.md factory/ plugin/ .codex/` returns nothing. Dispatch one `tier-mech` Codex
agent and confirm it resolves — today the same dispatch should 400/404.

## Done when
No retired model id anywhere; the TOMLs are regenerated (never hand-edited); the derived-drift Stop gate is
green; `factory/decision-log.md` and `plugin/docs/decision-log.md` noted; plugin version bumped.

## Out of scope
The Codex keep/freeze/narrow/drop decision itself (§12.1). If the owner chooses (C) drop, this item is
closed as superseded instead of implemented.
