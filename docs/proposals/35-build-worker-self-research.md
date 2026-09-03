# RFC 35 — Build-worker self-research (R-57)

Status: proposed · Date: 2026-09-02 · Owner: factory maintainer
Home: FACTORY RFC (own know-how), not a product project.
Origin: `docs/proposals/33-model-era-audit.md` §6 (R-57, cat. 4) + §14 row (`R-57 | Build workers
cannot self-research | docs/proposals/35-* | JUDGE | M | — | yes | n/a — uncontrolled fan-out cost
is the thing to size | n`) + work-plan step 13 ("needs a design pass with the owner in the room").
Not a BL — a design decision with real trade-offs, per the audit's own routing.

---

## 1. Summary

The four build workers (`backend-dev`, `frontend-dev`, `implementer`, `test-writer`) cannot look
anything up mid-build. Their `tools:` frontmatter is identical — `Read, Write, Edit, Grep, Glob,
Bash` — with no `WebSearch`/`WebFetch`/`Agent`. When a worker hits a real technical gap (a library's
current API, a deprecated method), its only documented move is to park it in
`comms/progress.md`/`inbox/decisions.md` and wait — never resolve it in-flight. The architect and
researcher both carry `WebSearch, WebFetch`. This RFC designs the fix (JUDGE-tier, owner-in-the-room
per the audit), not a mechanical BL edit.

---

## 2. Problem, with evidence

**2.1 The gap is real and uniform.** `plugin/agents/backend-dev.md:4`, `frontend-dev.md:4`,
`implementer.md:4`, `test-writer.md:4` — all four: `tools: Read, Write, Edit, Grep, Glob, Bash`.
Compare `architect.md:4-6` (`+ WebSearch, WebFetch`, `model: opus`) and `researcher.md:4-6`
(`WebSearch, WebFetch, Read, Grep, Glob`). Research tools exist in the agent vocabulary; they are
deliberately absent from the four build-loop agents.

**2.2 The workers say so themselves.** `backend-dev.md:16`: *"Never guess an unknown... You cannot
spawn subagents and the build has no research step. Instead: for an owner/product/irreversible
decision, write... to `inbox/decisions.md`... for a technical gap that unblocks later work, note it
in `comms/progress.md`."* `frontend-dev.md:25` and `analytics.md:18` carry the same line near-
verbatim. Honest about the tool gap, not a pretense.

**2.3 The architecture skill's stated mitigation is itself unreachable.**
`plugin/skills/architecture/SKILL.md:66`: *"The TECHNICAL research happens HERE... The dev agents
only research specific gaps on demand."* But "research on demand" needs a tool none of the four
have — the same shape as `docs/proposals/30-factory-contradiction-sweep.md` finding B3 (an
instruction assuming a tool the agent lacks), a distinct instance: B3 was "delegate to the
researcher" (fixed by deletion); here the line **is** the R-57 gap, not yet fixed.

**2.4 The engine builds no research step.** `plugin/templates/shared/.claude/engines/pandacorp-build.js:767-782`
— the four worker `agent()` calls (`test:`, `be:`, `fe:`, `build:${wo.id}`) pass a self-contained
prompt (WO body + `acText` + prior-attempt journal) and nothing resembling a research hand-off. No
`agentType:'pandacorp:researcher'` spawn exists in the build loop (only `pandacorp:architect`,
`pandacorp:implementer`, `pandacorp:devops` are spawned there).

**2.5 No confirmed incident — the cost is latent, not observed.** Searched `factory/memory/`
(`grep -ril "web\|websearch\|webfetch\|api changed\|deprecated\|hallucin\|guessed"`) and
`factory/backlog/`. Hits: `LESSON-0010` (researcher lacks `Write` — inverse problem), `LESSON-0120`
(WebFetch blocked on LinkedIn — a tool *limit*, not absence), plus unrelated guess-mentions
(LESSON-0080/0139/0146/0185, all UI/timing/telemetry). `BL-0088`/`BL-0003` matched on unrelated
keywords. **No LESSON/BL documents a worker guessing a stale API.** Matches the audit's own framing
(§14: *"n/a — uncontrolled fan-out cost is the thing to size"*) — structural, unmeasured cost.

---

## 3. Options

**A — Keep as is; blueprint/ADR pre-resolves every library question.** Only fix:
`architecture/SKILL.md:66`'s unreachable "research on demand" → "the dev agents flag a residual gap
via `comms/progress.md`/`decisions.md`; they never research it themselves," closing the B3-shaped
contradiction. Cost: zero new calls; pushed to `architect`/`researcher` at plan time, or to the
owner via `needs-owner`. DR-060/DR-015: untouched. DR-113: trivially portable (no new primitive).

**B — Give workers `WebFetch` only (docs lookup), capped per WO.** Add `WebFetch` (not
`WebSearch`) to the four `tools:` lines. New rule: on an unresolved library-API question, `WebFetch`
the library's own docs/CHANGELOG directly (never a search) — cap N fetches/WO, logged to
`comms/progress.md`. Cost: bounded but per-worker — at `powerful` mode's 8-WO wave, a 2-fetch/WO cap
adds up to 16 calls/wave worst case, small next to each worker's build/test loop but uncontrolled
across 4 independent agents. DR-060: no interaction (read-only). DR-015: none. DR-113: portable —
plain tool grant, cheapest to keep Codex in lockstep.

**C — Research-request path: worker files a question, a researcher subagent answers.**
Engine-level: a worker's `agent()` return schema gains `researchNeeded:[{question, why}]`; the
engine spawns `agentType:'pandacorp:researcher'` (mirrors the existing plan-spawn at
`pandacorp-build.js:646`), then re-invokes the worker with the answer appended — a bounded retry.
This is the mechanism B3 found unreachable, scoped correctly (engine-orchestrated, not a tool grant
the worker itself lacks means to invoke). Cost: ~2× calls per flagged WO only (self-reported gate,
not universal) — the "capped path" shape the audit's cost angle asks for. DR-060: safe by
construction (`researcher.md:4` has no `Write`, cannot race a sibling WO's artifacts). DR-015: none.
DR-113: heaviest to port — new schema + branch in `pandacorp-build.js`, a Dynamic-Workflow-specific
change (`Workflow` has "no equivalent" on other runtimes per AGENTS.md's tool-translation table);
a Codex build (PORT-5's narrow profile) needs its own simpler stand-in.

**D — Rely on the 1M context window; inject library docs at WO start.** No new tool grant: the
existing `plan` step (`agentType:'pandacorp:architect'`, line 646, already has `WebSearch`/
`WebFetch`) additionally fetches relevant docs/CHANGELOG excerpts into the WO's `acText` context
pack (extends the existing DR-108 injection at line 368). Cost: one fetch per WO at plan time
(cheapest aggregate), but only works if the plan step can predict which docs a WO needs — often not
knowable before implementation starts. DR-060/DR-015: none. DR-113: portable (prompt-injection only).

---

## 4. Red-team

- **A** — cheapest and safest, but doesn't fix R-57, only makes the constraint honest; the flagged
  failure (a gap becomes a full owner round-trip) persists. Legitimate only if the owner explicitly
  accepts that cost — not a default-by-inertia choice.
- **B** — a worker could still fetch a plausible-but-wrong docs page with nothing catching it before
  the gate; the cap bounds cost, not correctness. Four separate tool grants are four places to keep
  in sync later, versus one choke point in C.
- **C** — the structurally correct design, but real new surface in `pandacorp-build.js` (already the
  most-touched file in proposal 30's Fix Group A) whose 18/18 test suite must stay green; Claude-only
  per DR-113 until a Codex equivalent is separately designed.
- **D** — elegant but inverts the actual failure: the gaps that hurt are the ones nobody predicted
  at plan time (if predictable, the blueprint should already have specified the library precisely —
  `architecture/SKILL.md:66` already claims this). A nice-to-have on top of A, not a fix for the
  unknown-unknown class.
- **All four** — none is evaluated against real incident data (§2.5: none found). Paying for B, C,
  or D against a zero-observed cost is itself a flag; §5's canary exists to convert this from
  plausible to measured before committing to a heavier option.

---

## 5. Recommendation + canary

**Ship Option A now** (close the B3-shaped contradiction — zero cost, removes a live confusion),
**and run Option B as a scoped canary** before any permanent tool grant. §2.5 found zero incidents;
spending engine-maintenance budget (C) or granting fetch access with no measured payoff (B
unconditionally) is premature.

**Canary:** pick one FRD with a WO plausibly needing a current library API. **Run 1 (control):**
build as today. **Run 2 (treatment):** same FRD/WOs, workers granted `WebFetch` per B (capped at
N/WO), same model/effort otherwise. **Measure via `.pandacorp/track.jsonl`** — the engine's durable
per-attempt timeline (schema at `pandacorp-build.js:188`, line-builders ~198-244, 756, 799-800, 865):
compare per-WO **`reopen_count`** (DR-072 non-progress counter) and the **`rung`** distribution
(`build|patch|diagnose|verify|revert|gate|retry` — more `patch`/`revert`/`retry` on the same WO =
more rework) between runs, plus `needs-owner` blocks logged to `inbox/decisions.md`. **Verdict:** a
meaningful `reopen_count`/rework-rung drop in Run 2 with no new failure mode (fetch timeout, wrong
page) earns a rollout decision; an indistinguishable result stays open but unfunded — re-run with
N≥2 pairs before concluding, the same discipline proposal 33 applies to R-56 (never over-read one run).

---

## 6. Effort / impact / risk

| Option | Effort | Impact if real | Risk |
|---|---|---|---|
| A (status quo + doc fix) | S | Low — no fewer round-trips, just removes a doc contradiction | Low |
| B (WebFetch, capped) | S–M | Medium — could cut some round-trips cheaply | Low–Med (per-agent fan-out, wrong-URL risk) |
| C (research-request path) | M–L | High — structurally correct, matches audit's shape | Medium (new engine surface, Claude-only, 18/18 risk) |
| D (context-injection) | S–M | Low–Med — only helps predictable gaps | Low (doesn't address the real failure mode) |

---

## 7. Decision for the owner

1. Approve Option A's doc fix now (`architecture/SKILL.md:66`)? Low-risk regardless of the rest.
2. Authorize the Option B canary (one FRD, two runs, `WebFetch` capped at N/WO — pick N)?
3. If the canary shows real reduction, does B's per-agent grant ship as permanent, or graduate
   straight to C's single-choke-point path instead?
4. C and D are **not** recommended for action now — park pending the canary.

---

## 8. Sources

`docs/proposals/33-model-era-audit.md:195,854-856,930-931,993,622` (R-57 rows + routing + plan).
`plugin/agents/backend-dev.md:4,16`, `frontend-dev.md:4,25`, `implementer.md:4`, `test-writer.md:4`,
`analytics.md:4,18` (tool pins + "no research step" line). `plugin/agents/architect.md:4-6`,
`researcher.md:4-6` (the two agents with web tools). `plugin/skills/architecture/SKILL.md:66`
(unreachable mitigation). `plugin/templates/shared/.claude/engines/pandacorp-build.js:646`
(existing architect plan-spawn, Option C's model), `:767-782` (worker `agent()` calls, no research
hand-off), `:188-244,756,799-800,865` (track.jsonl/build-journal schema), `:368` (DR-108 `acText`
injection, Option D's extension point). `factory/decisions/registry.yaml:74-77` (DR-014),
`:337-341` (DR-060). `docs/proposals/30-factory-contradiction-sweep.md` finding B3 (prior instance
of the same unreachable-instruction shape; house style followed here). `factory/memory/` searched
via `grep -ril "web\|docs\|api changed\|deprecated\|hallucin" factory/memory/` — `LESSON-0010`,
`LESSON-0120` reviewed, neither a match. `factory/backlog/` searched the same way — `BL-0088`,
`BL-0003` reviewed, unrelated.
