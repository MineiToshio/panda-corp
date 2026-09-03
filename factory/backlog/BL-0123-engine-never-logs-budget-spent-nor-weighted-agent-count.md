---
id: BL-0123
type: bug
area: build-engine
title: "Engine never logs budget.spent() nor the final weighted agent count at quiesce -- BL-0098 canary had to reconstruct 34 units from transcripts"
status: open
severity: p2
opened: 2026-09-03
closed:
source: "canary evaluation of build wf_ddcc95c6 (mission-control FRD-24), 2026-09-03 (agent-inferred)"
closes:
links: [BL-0098, BL-0096, DR-070]
---

## Problem
The one supervised `powerful` build funded for BL-0098/0099/0102's canaries (mission-control, FRD-24, run
`wf_ddcc95c6`, `maxAgents: 30` cost-weighted, `maxFrds: 1`, 2026-09-03 17:41:44Z→~18:41Z) ended via
`stopReason: "maxFrds"` — but nothing the engine itself writes says how close it actually got to the
`maxAgents` cap it was also running against. BL-0098's evaluation had to fall back to an **external
reconstruction from transcripts**: 22 raw `agent-*.jsonl` files under the run's transcript dir, classified
by first-seen `message.model` per file — 6 `claude-opus-5`, 3 `claude-sonnet-5`, 13
`claude-haiku-4-5-20251001` — then hand-applying the engine's own `COST(m)` weighting
(`pandacorp-build.js:141`, `COST(m) = m==='opus'?3:1`) as a proxy: `6×3 + 3×1 + 13×1 = 34` weighted units,
**above** the `maxAgents: 30` cap the run was actually launched with. Whether the engine's own internal
`agentSpawned` counter agrees with that 34, or under/over-counted, is **unknown** — no event or
`status.yaml` field records the engine's own running counter or `budget.spent()` value at any point,
let alone at quiesce. The only real (non-reconstructed) figure for this run is BL-0096's `usage_summary`
line in `mission-control/.pandacorp/track.jsonl` (`cost_usd_total: 20.859274` ≈ $20.86, `calls_total: 876`
— sonnet 164 calls/$2.1997, opus 413 calls/$17.864173, haiku 299 calls/$0.7954), which is itself derived
externally from transcripts (BL-0096's `usage-rollup.mjs`), not read off the engine's live counters either.

Impact: every future "did the weighted cap actually hold" question (DR-070's whole reason for
cost-weighting `maxAgents`) requires the same manual transcript-reconstruction BL-0098 had to do by hand;
there is no cheap, durable, engine-authored answer to "how many weighted units did this run actually
spend, and against what ceiling."

**Where the counters live, never logged (`plugin/templates/shared/.claude/engines/pandacorp-build.js`):**
- `agentSpawned` — the running weighted counter — declared at line 104 (`let agentSpawned = 0`), read by
  `capHit()` at line 111, and incremented at ~35 call sites throughout the file (e.g. lines 541, 551, 576,
  604, 637, 692, 717, 766, 784, 828, 854, 899, 905, 938, 963, 998, 1014, 1032, 1051, 1063, 1089, 1119,
  1143, 1167, 1191, 1208, 1336, 1395, 1413, 1437, 1464, 1471, 1958, 1967, 2017, 2036, 2057, 2088, 2091,
  2095, 2101, 2113, 2128, 2135, 2141) — but its final value is never written anywhere; it lives only in
  the running Node process's memory and disappears when the process exits.
- `COST(m)` — the per-model weight function (opus=3, else 1) — defined at line 141.
- `budget.spent()` — read (never itself defined in this file — an injected Dynamic Workflows primitive)
  at the run-stop check, line 1846: `if (MAX_SPEND && budget.spent() >= MAX_SPEND) { stopReason =
  'budget'; ... }`; also referenced only in comments at lines 47-48 and 66 (`MAX_SPEND` declaration). Its
  value at that check, or at any other point, is never persisted.
- `BuildComplete` — the run's terminal-verdict event, defined at lines 261-262 (`const BUILD_COMPLETE =
  (verdict, frdsDoneTotal) => ...printf '{"event":"BuildComplete",...,"wos":"%s","frds":"...","verdict":"..."}'...`)
  and emitted at the two quiesce/close-out call sites: line 2105 (the `phase: release` / full-success
  close, `BUILD_COMPLETE('released', ...)`) and line 2129 (the partial/notify-end close,
  `BUILD_COMPLETE('partial', ...)`). Its payload today carries only `{at, project, wos, frds, verdict}` —
  no agent-count or spend field of any kind.

## Root cause
`agentSpawned` and `MAX_AGENTS`/`MAX_SPEND` exist purely as **in-process guardrail state** (DR-070's
cost-weighted brake), never as **observability state** — the engine was built to stop itself at the cap,
not to report how it got there. `BuildComplete`'s payload was scoped (E5, the slim-payload precedent
BL-0096 deliberately preserved) to the FRD/verdict shape the dashboard needed at the time; nobody has since
added the two extra numbers a cost-weighted cap needs to be auditable after the fact.

## Fix plan
At each of the two `BUILD_COMPLETE(...)` call sites (`pandacorp-build.js:2105` and `:2129`, i.e. at
quiesce/close-out), extend the emitted event AND append a sibling `.pandacorp/track.jsonl` line — keep the
existing `BuildComplete` dashboard event exactly as slim as it is (do not widen the E5 payload sent to
`~/.claude/dashboard-events.ndjson`, matching BL-0096's precedent) — carrying:
```
{ agentsWeighted: agentSpawned, agentsRaw: <count of agent-*.jsonl files this run wrote>,
  maxAgents: MAX_AGENTS, spentOutputTokens: budget.spent(), maxSpend: MAX_SPEND }
```
`agentsWeighted` is the live `agentSpawned` value read at the point of emission (it is already in scope at
both call sites). `agentsRaw` needs a raw increment counter alongside the existing weighted `agentSpawned`
increments (or a one-time count of the run's own transcript dir at quiesce, mirroring what the external
`maxAgents` brake in `implement/SKILL.md` already does against `agent-*.jsonl`). `spentOutputTokens` is
`budget.spent()` read at the same point (already called at line 1846; reuse rather than reimplement).
Land the new `track.jsonl` line next to (not replacing) BL-0096's `usage_summary` line, so a run's
weighted-agent-vs-cap accounting and its $/token accounting sit side by side without re-parsing
transcripts for either.

## Tests (prove the fix — TDD, RED → GREEN)
Add an assertion group to `plugin/scripts/test-pandacorp-build.mjs` (alongside the existing G11
"BuildComplete / GateVerdict emission presence" group, `test-pandacorp-build.mjs:1475-1502`, which already
asserts the close-out prompt carries the `BuildComplete` printf) asserting the close-out prompt/track-write
also carries all five new fields (`agentsWeighted`, `agentsRaw`, `maxAgents`, `spentOutputTokens`,
`maxSpend`) at both call sites (line ~2105 released path and line ~2129 partial path). RED = today, the
new assertion fails because neither field exists anywhere in the emitted payload. GREEN = after the fix,
the assertion passes at both sites.

## Done when
`node plugin/scripts/test-pandacorp-build.mjs` passes including the new assertions; a real build's
`.pandacorp/track.jsonl` carries the new line (with all five fields populated with real values) immediately
next to its `usage_summary` line at the same quiesce; BL-0098's open question ("did the weighted counter
agree with the transcript reconstruction's 34 units") can be answered by reading that one line off a future
run, with no transcript reconstruction needed.

## Out of scope
Changing `maxAgents`'s cost-weighting semantics or the cap value itself (DR-070 stands as-is — this item
only makes the existing counters observable, it does not change what they do); Mission Control UI for the
new fields; re-litigating BL-0098's own status (still `doing`, blocked on a future live build to compare
against once this lands).
