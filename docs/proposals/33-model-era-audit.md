# 33 — Model-era audit: is the factory a prosthesis for old models?

**Status:** proposed · **Date:** 2026-09-02 · **Owner:** factory maintainer
**Home:** this is a FACTORY proposal (about the factory's own know-how), not a product project.
**Repo state at audit time:** `main`, clean tree, HEAD `894ca85d` (2026-09-01), plugin v9.97.0.

**Thesis under test (not to confirm):** *"Much of the factory's scaffolding is a prosthesis for old models, and it also re-implements by hand things Claude Code now provides natively."*

> This document is **self-contained**. Every recommendation carries its evidence (`path:line`), its impact/effort/risk, its red-team verdict, its landing path and — where it removes or weakens a gate — the canary that must pass first. Nothing here has been executed; the audit was strictly read-only.

---

## 1 · Executive summary

**Half one of the thesis — "prosthesis for old models" — DIES.** Nine area audits hunted for hand-holding a current model no longer needs. Almost every piece of scaffolding traces to a dated, named incident (BL-0035's permanent data loss, the 2026-06-17 ~6M-token runaway, DR-100's 7k-LOC work order that took 5 gate attempts, the 2026-07-15 environment-misattribution incident) or to trust-architecture rules (generator ≠ verifier, human gates, protected paths, script-based verification) that a better model does not retire. The prune list is 11 rows against a 28-item "do not change" list.

**Half two — "re-implements native things by hand" — PARTLY STANDS, and shrank under red-team.** Of the ~10 adoption candidates, the three biggest are refuted by the primary sources they cited: `isolation:'worktree'` cannot express what either engine needs, `/goal` substitutes for neither half of the supervisor, and `--permission-prompts none` does not appear in the headless doc. What survives is a batch of small, real hook/permission adoptions.

**The third finding — "under-maintained, not over-scaffolded" — stands, reframed.** The factory's model-facing configuration is stale exactly where its alias abstraction does not reach (a Codex tier pinning a model retired 2026-08-31), and 11 mechanisms are promised in prose and wired nowhere. But two honesty corrections apply: (1) the commit histogram (**868 June · 296 July · 6 August · 2 September**, live count) is consistent with the owner simply pausing — it is not proof of neglect, and 24 of 25 stale findings were *filed during the busy period*, which is a prioritisation fact; (2) the self-diagnosis loop's **detection half works** — 6 of the 11 promise-without-mechanism instances were already caught and filed as open BLs, one nine days ago. What fails is **closing**, and no new MUST-check fixes that.

**Top 5:** (1) fix the three memory-loop bugs BL-0090/0088/0089 — S each, zero risk; (2) wire the three gates the factory already wrote and paid for (`check-standards.sh` is RED live, `check-preflight-drift.sh` is dormant, the registry's own counts drifted); (3) decide Codex — freeze or narrow, it taxes every unrelated change and has run nothing real in 48 days; (4) promote `LESSON-0113` for the 3 genuinely untracked instances; (5) add a minimal per-run cost/token rollup — without it every re-tier claim in this report is unfalsifiable.

**What the owner must decide:** Codex's future (§12.1), whether to fund one Fable recalibration sprint (§12.2), Mission Control's 77% commit share (§12.3), the memory promotion queue (§12.4), funding live validation of DR-117/118 (§12.5), the routines' permission posture (§12.6), and the copywriter re-tier + Haiku watch (§12.7).

---

## 2 · Method and cutoff date

**Cutoff:** 2026-09-02. All live counts, greps and script runs in this document were executed on that date against `main` at `894ca85d`.

| Stage | What was done |
|---|---|
| Inventory | One mechanical pass over the repo: skills, agents, standards, registry, hooks, backlog, memory, proposals, git history. Five of its figures were later found wrong and are corrected here (§10.4). |
| Model landscape | One research pass against Anthropic and OpenAI primary docs only; every unconfirmed figure carries `[UNVERIFIED]` (§3, §13). |
| Claude Code tool landscape | One research pass against `code.claude.com` + the npm-timestamped CHANGELOG; `[UNVERIFIED]` items listed explicitly (§4). |
| Area audits (a)–(i) | Nine parallel read-only auditors, model tier sized per area's complexity (CONV-12/DR-111), each on a shared brief: classify every finding into **exactly one** of 6 categories, cite `path:line`, tag every model-capability claim `[demonstrated: …]` or `[expected, not demonstrated]`, and **red-team every prune or re-tier-down** against `factory/memory/`, `factory/backlog/`, `docs/proposals/` and both decision logs. |
| Synthesis | One judge pass deduplicating the areas into a single catalogue, reconciling six genuine inter-auditor disagreements (§10.3) and rejecting unsupported inputs (§10.4). |
| Red-team | One adversarial pass whose job was to break the synthesis before the owner saw it: 24 corrections, 6 new findings, 3 refuted adoptions, one wrong commit histogram, one over-ranked Top-10 item. Its verdicts are binding on this document. |
| Orchestrator sampling | An independent spot-check of the area auditors' citation discipline: **4 of 5 sampled `path:line` citations exact, 1 off by two lines** (a tools-table row pointed two lines past the `@AGENTS.md` import, which is at `CLAUDE.md:5`; corrected everywhere here). **3 of 3 sampled source URLs live and matching.** |
| Final verification | The writer independently re-ran the commit histogram, `check-standards.sh`, and re-opened 18 cited lines. One further refutation was found this way (**R-49**, §10.2). |

**Evidence rules applied.** Every factual claim about repo state anchors to something observed with a tool in this session or in a cited area audit (CONV-13). Recorded state — a flag, a cached count, a prior audit — is treated as a claim to re-verify, not as evidence. Every capability claim is tagged `[demonstrated]` or `[expected, not demonstrated]`.

**What was NOT done.** No builds were run. No skill was executed. No file in the repo was modified by the audit (this proposal is the only artifact). `.pandacorp/`, `factory/ideas/`, `factory/profile.md`, `factory/portfolio.md` and `pandacorp-vault` were never touched; `factory/memory/` was read only. No claim about a model or a Claude Code feature is stated without a fetched primary source or an explicit `[UNVERIFIED]` tag. No token count, benchmark percentage or cost forecast was invented — §3's cost basis is computed arithmetic over published prices and is labelled as such.

---

## 3 · Verified model landscape

All rows **[VERIFIED]** against the sources in §13 unless tagged otherwise. Prices are USD per MTok.

| Model id | In / Out | Cache read | Context | Max output | Effort | Retirement (not sooner than) | Source |
|---|---|---|---|---|---|---|---|
| `claude-fable-5-1` | $10 / $50 | $0.25 (**0.025×**) | 1M | 128K | `low`–`max`, default `high`; thinking always on | 2027-09-01 | S3, S5, S6 |
| `claude-opus-5` | $5 / $25 | $0.50 (0.1×) | 1M | 128K (300K batch beta) | `low`–`max`, default `high`; adaptive by default | 2027-07-24 | S1, S5, S6 |
| `claude-sonnet-5` | $2 / $10 | $0.20 (0.1×) | 1M (always, no suffix) | 128K | `low`–`max`, default `high` | 2027-06-30 | S2, S5, S6 |
| `claude-haiku-4-5-20251001` | $1 / $5 | $0.10 (0.1×) | **200K** | 64K | **Not supported** (pre-4.6 "Extended" thinking) | **2026-10-15** — nearest of any active model | S5, S6 |
| `claude-opus-4-8` | $5 / $25 | $0.50 | 1M via `[1m]` | 128K | yes | 2027-05-28 | S4 |
| `claude-sonnet-4-6` | $3 / $15 | $0.30 | 1M via `[1m]` | 128K | yes | 2027-02-17 | S4 |
| `claude-sonnet-4-5-20250929` | $3 / $15 | $0.30 | 200K | 64K | yes | **2026-09-29** (under 4 weeks) | S4 |
| `claude-opus-4-1-20250805` | was $15 / $75 | — | — | — | — | **RETIRED 2026-08-05** | S4 |
| `claude-opus-4-20250514` / `claude-sonnet-4-20250514` | was $15/$75, $3/$15 | — | — | — | — | **RETIRED 2026-06-15** | S4 |
| `gpt-5.6-sol` | $4 / $20 | $0.40 | `[UNVERIFIED]` | — | `none`–`max` + `ultra` `[UNVERIFIED]` | current | S8, S9 |
| `gpt-5.6-terra` | $2 / $12 | $0.20 | `[UNVERIFIED]` | — | `none`–`max` + `ultra` `[UNVERIFIED]` | current | S8, S9 |
| `gpt-5.6-luna` | $0.20 / $1.20 | $0.02 | `[UNVERIFIED]` | — | up to `max`, no `ultra` `[UNVERIFIED]` | current | S8, S9 |
| `gpt-5.5` | $5 / $30 | $0.50 | `[UNVERIFIED]` (272K vs 1.05M sources conflict) | — | — | previous-generation flagship | S8, S9 |
| `gpt-5.4` | was $2.50 / $15 | $0.25 | — | — | — | **RETIRED from Codex 2026-08-31** → `gpt-5.6-terra` | S8 |
| `gpt-5.4-mini` | was $0.75 / $4.50 | $0.075 | — | — | — | **RETIRED from Codex 2026-08-31** → `gpt-5.6-luna` | S8 |

**The Codex retirement is a live, load-bearing finding.** `gpt-5.4` and `gpt-5.4-mini` passed their stated Codex retirement date two days before this audit. The factory's live pins, verified this session:

| Pin | Value | Status |
|---|---|---|
| `plugin/runtime/model-tiers.json:5` | `"codex": { "model": "gpt-5.4-mini", "effort": "low" }` | **retired model** |
| `.codex/agents/tier-mech.toml:3` | `model = "gpt-5.4-mini"` | **retired model** (generated — follows the JSON) |
| `factory/standards/agent-portability.md:44` | `gpt-5.4-mini (effort minimal/low)` | prose, retired model |
| `AGENTS.md:89` | *"Codex: gpt-5.4-mini/gpt-5.5 (medium effort)/gpt-5.5 (high effort)"* | prose, retired model |
| `plugin/runtime/model-tiers.json:9,13` | `"model": "gpt-5.5"` for STANDARD and JUDGE | valid, but **the most expensive current Codex option** |
| `plugin/runtime/model-tiers.json:4,8,12` | `"aliases": ["haiku"] / ["sonnet"] / ["opus"]` | **correct by design** — no dated Claude id anywhere |

The Claude half of the same table absorbed the entire 4.x→5 transition with **zero file edits**, because it pins aliases. The models it would otherwise have pinned (base Opus 4, Opus 4.1, Sonnet 4) are retired and would hard-fail with a 400 today. That contrast is the single best-aged design decision in the factory, and it is the exemplar the Codex fix should copy.

### 3.1 Cost basis (computed, labelled)

**Scenario, stated once and applied throughout:** 200,000 input tokens of which 80% (160,000) are prompt-cache reads and 20% (40,000) are regular input, plus 20,000 output tokens.
`cost = (40,000 × input + 160,000 × cache_read + 20,000 × output) / 1e6`.

| Model | Computed cost per call-unit |
|---|---:|
| `claude-fable-5-1` | **$1.4400** |
| `claude-opus-5` | **$0.7800** |
| `claude-sonnet-5` | **$0.3120** |
| `claude-haiku-4-5` | **$0.1560** |
| `claude-opus-4-8` | $0.7800 (identical to Opus 5) |
| `claude-sonnet-4-6` | $0.4680 |
| `gpt-5.6-sol` | $0.6240 |
| `gpt-5.6-terra` | $0.3520 |
| `gpt-5.6-luna` | $0.0352 |
| `gpt-5.5` (**currently pinned**) | **$0.8800** |
| `gpt-5.4-mini` (retired) | $0.1320 |

Derived deltas used in §7: **opus→sonnet −$0.4680 (−60%)** · **sonnet→haiku −$0.1560 (−50%)** · **opus→fable +$0.6600 (+85%)**.

⚠️ **This is a comparison index, not a spend forecast.** Real engine calls are not 200K/20K subtasks. Where call counts appear, they come from a **reference build defined here as 4 FRDs × 5 WOs, `powerful` mode, happy path (zero reopens)** ⇒ 9 JUDGE + 62 STANDARD + ~30 MECH ⇒ **≈ $31.04 per reference build in call-units**. No token count was invented; **R-12** records that the factory measures none.

Two facts that change cost reasoning and are easy to miss: Claude 4.7-and-later models use a **newer tokenizer producing ~30% more tokens for the same text**, so a fixed-token comparison understates the real delta versus the 4.x era; and Sonnet 5's introductory $2/$10 was **confirmed permanent** on the pricing page as read on the audit date — the scheduled 2026-09-01 bump to $3/$15 did not happen.

---

## 4 · Verified Claude Code tool landscape

Claude Code v2.1.259 (published 2026-09-02). Every URL accessed 2026-09-02. This table is the compressed form; §8 maps each row to the factory.

| Feature | Maturity | Version / date signal | Source |
|---|---|---|---|
| Dynamic Workflows (`Workflow`, `agent/parallel/pipeline/phase`) | GA | `ultracode` effort added v2.1.203+ | docs/en/workflows |
| `agent()` `isolation: worktree` / `remote` | GA | pre-existing; model-resolution order changed v2.1.251 | docs/en/sub-agents |
| `/deep-research` bundled workflow | GA | pre-existing | docs/en/workflows |
| `/loop`, `CronCreate/List/Delete`, `ScheduleWakeup` | GA, **session-scoped** | recurring `/loop` tasks **expire 7 days after creation** | docs/en/scheduled-tasks |
| Desktop scheduled tasks | GA | permission prompts **configurable per task** | docs/en/scheduled-tasks |
| Cloud Routines / `/schedule` | **Research preview** `[UNVERIFIED maturity label]` | 1-hour minimum interval; *"runs autonomously / no permission prompts"* | docs/en/routines, docs/en/scheduled-tasks |
| `Monitor` (background log/process watch) | GA | pre-existing | docs/en/tools-reference |
| `/goal` (condition-driven loop) | GA | idle check-ins v2.1.234–246; **capped at 3 idle check-ins per goal**; backs off 30 m → 1 h → 2 h; **skips evaluation while a subagent or background shell is running**; evaluator **calls no tools** | docs/en/goal |
| `PushNotification` | GA | — | docs/en/sub-agents |
| Agent frontmatter `effort` / `experimental.cacheTtl` / `maxTurns` / `background` | GA (`cacheTtl` v2.1.248) `[PARTIALLY UNVERIFIED field table]` | workflow agents fall outside the main cache TTL bucket (**5 min default**), changed via the **`subagentPromptCacheTtl` setting** | docs/en/sub-agents, docs/en/workflows |
| Agent Teams | **Experimental**, opt-in, off by default | `TeamCreate`/`TeamDelete` removed v2.1.178 | docs/en/agent-teams |
| Fork subagents / `/subtask` | GA | `/fork` renamed v2.1.212 | docs/en/sub-agents |
| Cross-session `SendMessage` / `ListAgents` | GA (opt-in) | same-machine v2.1.224 | docs/en/cross-session-messaging |
| `EnterWorktree` / `ExitWorktree` | GA | pre-existing | docs/en/worktrees |
| Hooks — **33 documented events**; `command`/`prompt`/`agent`/`async`/`http`/`mcp_tool` types | GA (agent-hooks experimental) | `PreModelSwitch` v2.1.251; `"async": true` + `asyncRewake` documented | docs/en/hooks |
| Artifacts | GA (Pro/Max/Team) | comments v2.1.221+; `/design` canvas v2.1.234+ | docs/en/artifacts |
| Claude Design canvas (`/design`, `.dc.html`) | **Research preview** | v2.1.234+ | docs/en/artifacts |
| Agent Skills open standard (`SKILL.md`) | GA | boolean-frontmatter laxity v2.1.218 | docs/en/skills |
| Plugins, marketplaces, `claude plugin validate` | GA | `--json` on validate v2.1.259 | docs/en/plugins |
| Auto memory; `.claude/rules/` path-scoped rules; `/import` | GA | `/import` v2.1.213+ | docs/en/memory |
| Permission modes (`default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`) | GA | `auto` default on Pro/Max/Team CLI **v2.1.228 (2026-08-11)**; `dontAsk` *"denies anything not in your `permissions.allow` rules or the read-only command set"* | docs/en/permission-modes |
| `claude -p` headless | GA | `--restricted` v2.1.248; **starting mode is "Manual on every plan"** | docs/en/headless |
| Bash sandbox (`/sandbox`, Seatbelt) | GA (macOS/Linux/WSL2) | `sandbox.filesystem.disabled` v2.1.216 | docs/en/sandboxing |
| `fewer-permission-prompts` (bundled skill) | GA | — | docs/en/skills |
| OpenTelemetry export; `/cost`, `/usage` | GA | per-session prompt-cache line v2.1.251 | docs/en/monitoring-usage |
| MCP v2, `ToolSearch`, `managedMcpServers` | GA | `managedMcpServers` v2.1.259 | docs/en/mcp |
| Remote Control, `/teleport`, self-hosted runners | GA `[PARTIALLY UNVERIFIED]` | self-hosted added v2.1.224 | docs/en/remote-control, /desktop |
| `/code-review`, `/simplify`, `/security-review` | GA locally; cloud review in research preview | `--post` v2.1.227 | docs/en/code-review |
| Claude Agent SDK / Managed Agents | GA `[PARTIALLY UNVERIFIED for Managed Agents]` | — | docs/en/agent-sdk/overview |

### 4.1 Items explicitly `[UNVERIFIED]` — no work may be scoped on these

| Item | Why unverified |
|---|---|
| **`claude plugin eval`** (eval suites, JSON report, sandbox, CI) | Referenced by name in the session's own agent-routing config; **not confirmed against a fetched primary doc page**. Gates **R-63**. |
| **`/skill-doctor`** | Same status — named in agent-routing config only. |
| **`--permission-prompts none`** | **Does not appear on `docs/en/headless`.** It was inherited from the tool survey and presented as a shipped fix; the documented locked-down mode is **`--permission-mode dontAsk`**. Gates **R-18**. |
| **`.codex-plugin/plugin.json` as a standard** | Not found in Anthropic's plugin documentation. It is a project-specific generated projection, not a documented Claude Code feature. |
| **Cloud Routines "research preview" label** | `docs/en/scheduled-tasks` confirms the 1-hour minimum and autonomous execution but **does not use that maturity label**. Gates **R-24**. |
| **`agent()` accepting `isolation`** | Neither `docs/en/workflows` nor `docs/en/sub-agents` documents `isolation` as an option of the **Workflow script's `agent()` function**. This is separate from — and additional to — the semantic refutation in §10.1. |
| **Which cache-TTL knob applies to workflow-spawned agents** | Agent frontmatter `experimental.cacheTtl` vs the `subagentPromptCacheTtl` setting. Gates **R-25**. |
| `.claude/agents/*.md` full frontmatter field table | Captured from a summarization, not a verbatim primary quote. `[PARTIALLY UNVERIFIED]` |
| iOS Simulator pane mechanics; self-hosted environments page; Managed Agents page; `/security-review` dedicated page | Cross-referenced, not directly fetched. `[PARTIALLY UNVERIFIED]` — none is load-bearing here. |
| GPT-5.6 context windows, effort levels incl. `ultra`, SWE-bench figures, the `$1/$6–$5/$30` price range | `openai.com` returned HTTP 403; secondary sources only. **No recommendation in this document rests on any of them.** |
| Every "N hours of autonomous work" claim, and every absolute benchmark percentage for Opus 5 / Sonnet 5 / Fable 5.1 | **No fetched Anthropic or OpenAI source made such a claim.** Anthropic has moved off SWE-bench Verified as a headline. |
| Whether Claude Code exposes a **consumable installed-vs-source plugin-version signal** Mission Control could read for its drift banner (FRD-15) | `claude plugin validate --json` (v2.1.259) is documented; a consumable version API is not. **`[UNVERIFIED]` — unresolved, no action proposed.** |
| Haiku 4.5's release date (inferred from the dated snapshot suffix); Fable 5.1's "~25–45% cheaper" cost framing | Neither is spelled out in a fetched primary source. `[UNVERIFIED]` — neither is load-bearing here. |

---

## 5 · Findings by area

Categories per the audit brief: **1** obsolete prosthesis · **2** model-independent rule · **3** re-tier · **4** new capability by model · **5** new capability by Claude Code tool · **6** process debt. Every row carries exactly one.

### (a) Skills prose — thesis **DIES**

26 skills / 1,619 lines. Reminder-density is flat at 10–20% across the set rather than concentrated, and most of it cites constitution rules (§22 untrusted worker, protected paths) rather than hand-holding. The one duplication a naive auditor would flag (the DR-045 preflight) was already audited and extraction was **explicitly rejected** in favour of byte-identical spans plus a drift script — a stronger guarantee, except the script runs nowhere.

| id | Cat | Finding | Evidence | Origin | Verdict |
|---|---|---|---|---|---|
| R-43 | 6 | `check-preflight-drift.sh` is fully dormant — written, tested, invoked by nothing | `plugin/docs/decision-log.md:718,722`; `factory/backlog/BL-0042-*.md:55`; the script's own usage line `:37` — no hook, skill or CI reference | DR-045 / BL-0042 canonicalization, v9.84.0 | stands (grep-verified twice) |
| R-29 | 5 | `AskUserQuestion` is never used; every owner gate is freeform prose | 0 hits across `plugin/skills/*/SKILL.md`; `factory/standards/agent-portability.md:65` already defines the fallback | none rejecting it | downgraded to a single-skill trial |
| R-52 | 6 | The four-planes routing table is restated in four files with no drift gate | `AGENTS.md:44-50` (canonical) vs `plugin/skills/learn/SKILL.md:16-21`, `memory/SKILL.md:33-36`, `absorb/SKILL.md:62,89-93` | organic — a `SKILL.md` body has no `@import` | stands as downgraded (extract **plus** an explicit read instruction) |
| R-72 | 6 | **NEW.** The two "recurring `/loop` jobs" are advertised on a mechanism that expires in 7 days | `plugin/skills/memory/SKILL.md:3,14` and `review-launch/SKILL.md:3,34` both present as `/loop` jobs; `/loop` tasks are session-scoped and **expire 7 days after creation**; the durable mechanism is `plugin/docs/routines.md:3-4`'s Desktop scheduled tasks, which the file itself says *"does NOT live in this repo"* | none | stands — a 12th instance of the promise-without-mechanism pattern, inside the loop this audit is testing |
| R-54 | 3 | The haiku "cwd drift" ANCHOR workaround is undated and unverified against the current haiku | `plugin/skills/implement-backlog/SKILL.md:45` — no BL/DR id, no date | none cited | downgraded from "re-tier down" to "verify, don't remove" |
| R-55 | 3 | The memory harvest's "huge project" GOLD-first threshold is qualitative and may be stale with 1M context | `plugin/skills/memory/SKILL.md:15`; `plugin/skills/spec/SKILL.md:29` (lost-in-the-middle) | DR-047 loop v2, no incident | downgraded — deleting the passage dies |
| R-53 | 6 | The CONV-12 rubric is restated inline in `absorb` while `implement-backlog` correctly points at it | inline: `plugin/skills/absorb/SKILL.md:45,105`; pointer: `implement-backlog/SKILL.md:52` | organic | stands, **citation corrected** — `learn/SKILL.md:43` is an *application* of the rule (a DR-116 delegation), not a restatement |

### (b) Agents & tier policy — thesis **PARTLY STANDS**

14 agents: 5 opus / 9 sonnet, 9 with `effort:` pinned, 4 of them the `sonnet`+`high` hybrid — all verified per-file. The pins are defensible one by one; three edge failures are real. Everything structural (DR-015 separation, `disallowedTools` on the auditor, byte-identical memory blocks, headless Playwright, the Codex-mirror drift gate) is correct and drift-free — all 14 mirrors match their sources.

| id | Cat | Finding | Evidence | Origin | Verdict |
|---|---|---|---|---|---|
| R-05 | 3 | The backlog-scan step asks a haiku agent to perform judgment | `.claude/engines/pandacorp-backlog.js:87-91` — rubric asks it to judge *"how much its `## Fix plan` section actually touches (read the file body, not just the frontmatter)"*, dispatched `model: 'haiku'`; MECH is defined as *"mechanical, zero judgment… grep-and-report"* (`factory/standards/conventions.md:48`) | `plugin/docs/decision-log.md:783` | stands, **evidence re-labelled** (see §6) |
| R-06 | 6 | A de-facto 4th tier (`sonnet` + `effort: high`) is load-bearing and unnamed in the canonical vocabulary | `analytics/devops/librarian/security-auditor` pin both; `plugin/scripts/generate-codex-agents.mjs:106-123` records why it must never collapse (*"the silent downgrade hit security-auditor, analytics, devops and librarian — Fable-audit 2026-07-04 #5"*); `factory/standards/agent-portability.md:38-53` names only three tiers | predates/parallels PORT-2 | stands as doc-only |
| R-08 | 6 | The agents' `model:` pin is not what runs — the engine overrides it per work order | `pandacorp-build.js:700-703` `pickWorkerModel()` returns `'opus'` on `difficulty:high` or `reopen_count>=1`; dispatched at `:770`/`:772`/`:782` with `model: woModel`; `backend-dev.md:5` gives no hint | DR-073 | stands (doc clarity only) |
| R-09 | 3 | `test-writer` is never escalated even when its paired implementer is — a **double** asymmetry | `pandacorp-build.js:768` `model: P.worker` always, vs `:770`/`:782` `model: woModel, effort: woModel === 'opus' ? 'high' : undefined` | none found | stands as an owner question |
| R-10 | 3 | DR-015's "different model breaks shared bias" may be weaker among same-generation Claude 5 siblings | `plugin/agents/reviewer.md:9` already hedges (*"a different model FAMILY (non-Claude) is even better"*); `factory/decisions/registry.yaml:83` | DR-015 | dies as an action item, survives as an owner question |
| R-57 | 4 | Build workers cannot self-research, so any technical gap becomes an owner round-trip | `plugin/agents/analytics.md:18`, `backend-dev.md:16`, `frontend-dev.md:25` — *"You cannot spawn subagents and the build has no research step"*; none lists `Agent`/`Task` in `tools:` | DR-014 (`registry.yaml:74-77`) | stands as a proposal candidate, not a prompt edit |

### (c) Build engine, hooks, supervisor — thesis **DIES, decisively**

The area the thesis targeted hardest is where it fails hardest. Every hand-rolled subsystem carries an inline dated rationale; the atomic lease exists because *"Dynamic Workflow JavaScript has no native filesystem/process channel"* (`factory/standards/build-orchestration.md:713-714`) — a platform fact, not a model gap. Of 10 plugin hooks, 6 are Category 2; the most-suspected one (`capture-lessons-reminder.sh`) is throttled four ways. What the area surfaced instead is **verification debt** and **hook latency**.

| id | Cat | Finding | Evidence | Origin | Verdict |
|---|---|---|---|---|---|
| R-44 | 6 | DR-117/118 have never been live-validated; the engine has no offline seam and no CI | `factory/backlog/BL-0063-*.md` (open 2026-07-10): *"NO offline test seam… validated only by 'the next real build'"*; `BL-0069-*.md` (open 2026-07-12): no `.github/workflows/`, the 12 `test-*.mjs` suites *"only ever run when an agent remembers"* | DR-117/DR-118 (2026-07-07) | stands — predates the model question entirely |
| R-45 | 6 | BL-0051 (**p1**) — a reopened-FRD WO derogating a blessed reviewer test can deadlock the build; observed live on MC FRD-23 | `factory/backlog/BL-0051-*.md` (open since 2026-07-07); links LESSON-0002, DR-080 | live incident 2026-07-07 | stands — highest-severity open engine item |
| R-46 | 6 | `check-derived-drift.sh` runs its full 7-check sequence on **every** Stop in the factory, with no "did this session touch `plugin/`" gate | `plugin/hooks/hooks.json:73-78`; only early exits are the `stop_hook_active` loop guard and "outside the factory repo"; `BL-0082` (open) records an innocent session reddened by a parallel plugin edit | BL-0082 | stands as a scope fix; removing the check dies |
| R-69 | 6 | **NEW.** `backup-pandacorp-state.sh` runs **twice** on every factory session start | `plugin/hooks/hooks.json:8` runs `${CLAUDE_PLUGIN_ROOT}/scripts/backup-pandacorp-state.sh`; `.claude/settings.json:20-25` runs `$CLAUDE_PROJECT_DIR/plugin/scripts/backup-pandacorp-state.sh "$CLAUDE_PROJECT_DIR"` — same script, two synchronous 30 s-budget invocations | none | stands — latency and possible correctness; one BL to decide which copy owns the job |
| R-70 | 6 | **NEW.** The Stop path is far heavier than the SessionStart path the latency argument targets | `plugin/hooks/hooks.json:57-79`: `verify-before-stop.sh` **timeout 300** + `capture-lessons-reminder.sh` 15 + `check-derived-drift.sh` 30 = up to **345 s** synchronous per Stop, vs ~115 s at SessionStart | none | stands — measure both before arguing latency |
| R-14 | 5 | The native `budget` primitive is distrusted and shadowed by a hand-rolled cost-weighted counter | `pandacorp-build.js:47-48` *"`args.maxSpend`… UNRELIABLE alone (under-counts subagent work; unenforced if the supervisor dies)"*; `:67` *"`args.maxAgents`… THE reliable overnight guardrail"*; `:141` `const COST = (m) => (m === 'opus' ? 3 : 1)` | a real 2026-06-17 run hit ~6M tokens with `maxSpend` set to 2M (`build-orchestration.md:487-491`) | downgraded to "measure, don't touch" |
| R-66 | 2 | The hand-rolled engine subsystems are correct as built | `pandacorp-build.js:180-202` (journal, because `resumeFromRunId` is per-run), `:21-32,100-102` (lease via an external CLI), `:264-267` (DR-108 MECH offload), `:279`/`:556` (gate worktree + BL-0067's crash-evidence rule) | DR-050/060/086/108/117/118 | **thesis dies here** — each traces to a dated incident or a hard platform constraint |

### (d) Standards & registries — thesis **DIES for content, STANDS for metadata**

105 of 137 registry rules are `manual`, but the bulk is deliberate independent-review architecture (~35 reviewer-lens rows, ~15 human gates, ~12 auditor-checklist rows) that a better model does not retire — constitution §22/§24. The genuine finding is that the standard *about prompting* is the most stale artifact in the repo, and that the registry's own health machinery has drifted and stopped running.

| id | Cat | Finding | Evidence | Origin | Verdict |
|---|---|---|---|---|---|
| R-02 | 6 | The prompting standard declares itself tuned for a superseded generation | `factory/standards/prompting-conventions.md:5-6` *"consumed daily by **Opus 4.8 / Sonnet-class models**… degrade when shouted at in triplicate, and over-trigger on absolutist imperatives written for weaker models"*; repeated `:48` and verbatim in `factory/decisions/registry.yaml:661` | DR-114, Fable hardening sprint WS3 2026-07-04 (`docs/proposals/26-fable-hardening-sprint.md`) | stands, downgraded to "re-run the audit", **plus** the de-version edit itself needs a PROMPT-6 receipt |
| R-41 | 6 | `check-standards.sh` has been RED in a clean tree since 2026-07-09 — and nothing runs it | **Re-run live in this session:** `FAIL document-consistency.md: not represented in rule-registry.md` + `FAIL single-source-of-truth.md: …`. `grep -rn check-standards` finds no hook, routine or CI caller. `factory/backlog/BL-0055-*.md:6` `status: open`, whose own root cause reads *"it is not wired into any hook, gate or routine: nobody runs it"* | BL-0055 (2026-07-09) | stands — verified live, not from memory |
| R-40 | 6 | The rule registry's own summary counts have drifted from its table | `factory/standards/rule-registry.md:159-161` claims *"138 rules → 31 wired · 106 manual · 1 aspirational"*; a live `awk` count gives **137 rows: 31 wired, 105 manual, 1 aspirational** | none — hand-typed prose beside a hand-maintained table | stands; the recount must exclude the ~5 non-rule table rows a naive `^\|` grep picks up (a raw `^\|` count returns 143) |
| R-42 | 6 | `PERF-3` is the sole surviving aspirational SHOULD, unwired | `factory/standards/rule-registry.md:69` (`review-only \| aspirational`); `:157` *"candidate for a future lint pass"* | 2026-07-02 catalog audit (`docs/proposals/24`), left open deliberately | stands — the registry self-diagnoses the fix |
| R-60 | 6 | The "always"-injected rule layer is 289 lines, not the ~169 recorded in owner memory | 9 files with `applies_when: always` in `plugin/templates/rules/` = **289 lines** (independently confirmed twice) | growth is legitimate — `debugging.md` (DEBUG-1..4, 2026-07-15) and DR-102 items added after the baseline | stands as a freshness correction |
| R-68 | 2 | DEBUG-1..4, the memory anchor gate, CONV-13, DR-015, `MAX_AGENTS`, `MAX_REOPENS` and the Fable exclusion all stay | `factory/standards/debugging.md:70-72` (incidents dated 2026-07-13 and 2026-07-15); `memory-harvesting.md:105`; `conventions.md:57`; `pandacorp-build.js:67,71`; `conventions.md:51` + `registry.yaml:646` | various | keep — "a better model wouldn't need to suspect its own environment" is unsupported |

### (e) Memory loop — thesis **DIES; the loop's own second half is the problem**

Capture works (0 pending inbox notes; last drain 2026-09-01, `27e8c91f`), retrieval is genuinely wired into 7 agents with deterministic citation counting, and the prune freeze exercised real conservatism (zero deprecations with a written justification, `894ca85d`). The funnel stalls after that: 163 of 177 lessons are `candidate`, 13 sit at `promotion: proposed` for 6–9 weeks.

| id | Cat | Finding | Evidence | Origin | Verdict |
|---|---|---|---|---|---|
| R-35 | 6 | Three open BLs break the memory loop's own "it closes" story | `BL-0088` (open 2026-08-03): `learn` sets `promotion: approved` but never flips `status: candidate → active` — confirmed live on `LESSON-0147`, `LESSON-0152`. `BL-0089` (open 2026-08-25): harvest never instructs committing its own output. `BL-0090` (open 2026-09-01): the eval-gate's owner-stated OR-branch never fires — **10 lessons stuck at `candidate` for 6–9 weeks despite `provenance: owner-stated`** | DR-047 loop v1/v2 | stands — "backlog noise" dies |
| R-36 | 6 | The factory named its own recurring failure mode as a lesson, and that lesson is itself stuck unpromoted for 7 weeks | `factory/memory/LESSON-0113-documented-trigger-without-installed-mechanism.md:11-12` — `status: candidate`, `promotion: proposed # 2026-07-16`; context at `:6`, trigger at `:7`, corroborated across 2 projects at `:8` | 2026-07-02 standards audit + 2026-07-07 FRD-23 build (BL-0052) | stands, **downgraded H → M** — the loop already caught 6 of the 11 instances (§10.1) |
| R-37 | 6 | `LESSON-0096` (`ScheduleWakeup` misuse) sits unpromoted since 2026-07-16 despite two independent near-miss incidents | `factory/memory/LESSON-0096-*.md:8,19-36`; `factory/memory/_inbox.md:462-474` | two live incidents | stands, but **now blocked on R-71** |
| R-71 | 6 | **NEW.** `LESSON-0096` contradicts `implement/SKILL.md`'s supervisor contract — resolve before promoting | `LESSON-0096-*.md:8` calls `ScheduleWakeup` outside `/loop` *"a misuse"*; `plugin/skills/implement/SKILL.md:70,77` **mandates** a dedicated ~2-min `ScheduleWakeup` outside `/loop` as the lease-renewal timer; `docs/en/scheduled-tasks` mentions `ScheduleWakeup` only in the self-paced-`/loop` context | none | stands as a **contradiction to resolve**, not a proven defect — the lesson is `agent-inferred`, `confidence: medium`, and the docs do not explicitly forbid the use |
| R-38 | 6 | The promotion queue is stale: 13 lessons `promotion: proposed`, oldest 9 weeks | live `grep -l "^promotion: proposed"` → **13**, range 2026-06-30 → 2026-07-24 | DR-047 loop v2 | stands |
| R-39 | 6 | Retrieval is wired into 7 agents, but only 10 of 177 lessons show any use | `plugin/agents/architect.md:26`, `implementer.md:35`, `reviewer.md:93` + frontend-dev/backend-dev/test-writer/designer carry the INDEX-first block; `applied_in` non-empty on 10; `times_applied` = 167×0, 8×1, 2×3 | DR-047 loop v2 | downgraded from "retrieval is decorative" to "insufficient project volume to judge" |
| R-67 | 2 | Auto-memory and `factory/memory/` are correctly separate; the capture backstop works as designed | `factory/memory/README.md:9-16`; `plugin/scripts/capture-lessons-reminder.sh:1-9,15-38` (fires at most once per session, silent if the inbox was touched in 60 min or the session had <6 turns) | DR-033, DR-047, DR-011 | keep — "native auto-memory covers this" dies on scope |

### (f) Codex / dual-runtime — thesis **STANDS in a different sense: not prosthesis, but sunk cost awaiting a decision**

| id | Cat | Finding | Evidence | Origin | Verdict |
|---|---|---|---|---|---|
| R-30 | 6 | A dormant 11-day sprint awaiting a decision that was formally requested and never made | `git log --since=2026-06-01 -- .codex factory/standards/agent-portability.md docs/proposals/32-native-dual-runtime plugin/runtime/codex \| wc -l` → **30 commits**, all 2026-07-04..07-15; `--since=2026-07-16` → **0** (48 days). `docs/proposals/32-native-dual-runtime/claude-code-review-report.md:278` asks the question verbatim and **names its own reopen trigger**: *"reevaluation trigger: Codex ships wake-capable local scheduling"* | DR-113, proposal 32 (owner-approved 2026-07-11), PORT-5 promoted 2026-07-15 | stands; the recommendation moves from "(D) narrow" to **"(B) freeze or (D) narrow, owner's call"** |
| R-34 | 6 | The one dated write-capable Codex run **coincides in time** with an unexplained deletion | `factory/decision-log.md:672-676` (BL-0035 closure) names Codex *"sospechoso principal NO confirmado"*; `factory/backlog/BL-0035-*.md:23-27` records root cause **"UNKNOWN"** with **three unranked candidates** (Codex, a worktree-sweep script, a merge-queue teardown). The one positive is self-referential: `LESSON-0067`, a Codex pass catching two blockers **in the portability layer Codex was part of** | BL-0035 / proposal 25 | stands, **title softened** — coincidence in time, not correlation with harm |
| R-31 | 6 | Dual-runtime imposes a permanent per-change tax on every unrelated Claude-only edit | `factory/standards/agent-portability.md:222,225-226` (mandatory regen on every agent/manifest/enforcement edit); `plugin/hooks/hooks.json:71-77` (drift gate on every Stop); `docs/proposals/32-native-dual-runtime/README.md:879-902` §13.1 makes portability *"part of the definition of done for **every** factory change"* | DR-115 generalized via DR-113 | downgraded — proportionate only if the capability is kept |
| R-32 | 6 | `CLAUDE.md` has been stale about Codex's own promoted capability since the day it was promoted | `CLAUDE.md:15` — *"other runtimes remain read/review-only on project build state"* — vs `AGENTS.md:98` and `agent-portability.md:84-121` (PORT-5's promoted `attended_foreground` profile), both correct | the promotion commit updated two files, not three | stands |
| R-33 | 6 | 19% of the open backlog is Codex-specific, all filed in one July window, none touched since | 45 open items; 9 mention Codex (BL-0030/0031/0032/0044/0065/0070/0071/0080/0084), all opened 2026-07-04..16 | proposal 32 §14 follow-ups | downgraded from "close them" to "triage as a batch" |
| R-73 | 6 | **NEW.** The "review-only" property that makes narrowing safe is **prose, not a mechanism** | `plugin/runtime/enforcement-policy.json:11` grants Codex `sandbox_mode: "workspace-write"`; the read/review-only boundary lives only in `agent-portability.md` PORT-5 text; **BL-0030 (the hook-portability gap) is open and untouched since July** | PORT-6 gap | stands — this is itself a promise-without-mechanism instance *inside* the recommendation. **BL-0030 is a hard prerequisite for any narrow-to-reviewer option** |
| R-74 | 6 | **NEW.** The contradiction sweep already flagged `AGENTS.md:89`'s Codex tier line — and it is still wrong | `docs/proposals/30-factory-contradiction-sweep.md:108` records finding **N3 "confirmed"**; `AGENTS.md:89` still reads *"gpt-5.4-mini/gpt-5.5 (medium effort)/gpt-5.5 (high effort)"* | 2026-07-05 sweep | stands — R-01's fix and N3's fix are the same edit; N3 has been confirmed-and-open since the sweep |

### (g) Mission Control as mirror — thesis **DIES; DR-046 works where it is derived and rots where it is hand-authored**

| id | Cat | Finding | Evidence | Origin | Verdict |
|---|---|---|---|---|---|
| R-47 | 6 | The Manual's architecture skill page is silently orphaned by a stale slug | `mission-control/src/lib/manual/skill-flows.ts:417` `slug: "blueprint"`; `plugin/skills/blueprint` does not exist (only `plugin/skills/architecture`); `getSkillFlow` (`:1229-1231`) is a bare `FLOW_BY_SLUG[slug]` with no alias, so `SkillDetail.tsx:158-159` falls back to raw **English** frontmatter | the 2026-06-30 `blueprint → architecture` rename (`mission-control/docs/decision-log.md:1045`) updated prose, not this key | stands — reproducible drift, a live DR-046 violation |
| R-48 | 6 | Nothing guards the hand-authored explainer layer against skill renames | `skill-flows.ts:9-11` states the accuracy contract; no test enforces it; R-47 is the proof it decays | DR-046's two-layer design | downgraded from "remove the hand layer" — the curated Spanish explainer is real value under CONV-11/DR-110 |
| R-51 | 6 | BL-0062 — the decision-id algorithm is hand-implemented twice, in skill prose and in TypeScript | `factory/backlog/BL-0062-*.md` (open 2026-07-10): `plugin/skills/decide/SKILL.md` step 1 restates what `mission-control/src/lib/docs/activity.ts` implements; *"nothing today would catch the two disagreeing"* | no shared spec | stands as filed; `[expected, not demonstrated]` — no divergence observed yet |
| R-50 | 2 | Mission Control is 77% of factory commits and 11% of its own code is gamification — both trace to owner intent | `git log --oneline \| wc -l` → 1,172; `-- mission-control` → **900 (76.8%)**; `-- plugin` → 260; `-- factory` → 253 (overlapping). Party/Fragua 7,062 + gamification 3,280 + achievements 9,966 ≈ 20,308 of 182,490 src lines. `factory/portfolio.md:8`: MC is `return_type: personal`, *"éxito = uso diario del propio operador"* | owner taste, corroborated in memory `design-taste-rpg.md` | surface the number; "cut gamification" dies |
| R-49 | 6 | The MC deploy machinery has no backup and has already been swept once | `factory/decision-log.md:590` names the follow-up: *"the deploy machinery has no backup and can be swept again"* | DR-089/090 | **DIES — refuted this session.** See §10.2 |

### (h) Cost — thesis is **UNTESTABLE here, which is itself the finding**

"Budget" in this codebase means a **weighted count of subagent calls**, never tokens or dollars.

| id | Cat | Finding | Evidence | Origin | Verdict |
|---|---|---|---|---|---|
| R-12 | 6 | No $ or token telemetry exists anywhere; the observability FRD scoped it out and nothing tracks the gap | `pandacorp-build.js:177-198` — `TRACK()` writes `{kind, at, frd, wo, state, verdict}`, **zero cost/token fields**; `mission-control/docs/frds/frd-12-observability-dataviz/frd.md:62,66` — Non-goal *"does not compute cost/tokens in v1"*, Future *"Cost/tokens per agent and per project"*; FRD-12 `VERIFIED` since 2026-06-21 with **no BL** | never attempted, not rejected | stands — every re-tier decision here is unfalsifiable until this lands |
| R-13 | 6 | The engine's cost weight and the memory store's cost lesson are both unvalidated estimates | `pandacorp-build.js:141` `COST = (m) => (m === 'opus' ? 3 : 1)`, derived from `docs/proposals/12-adaptive-repair-and-model-selection.md:85` (one incident's estimate), never recalibrated; `LESSON-0176` holds a `~10x` claim at `provenance: agent-inferred`, `confidence: medium`, `times_applied: 0` | proposal 12 | stands — §3.1's verified prices put the real opus:sonnet ratio at **2.5×**, not 3× |
| R-11 | 3 | Some JUDGE call *sites* are bounded classification or git surgery, not open-ended judgment | 14 JUDGE dispatches in `pandacorp-build.js` (585/616/646/868/983/1067/1104/1123/1169/1184/1203/1385/1417/2064). Surviving candidates: **`diagnose` (`:1417`, read-only classification)** and **`revert` (`:1169`, git surgery)** | DR-015/DR-073/DR-117 | **downgraded hard, M → L.** `gate-test-repair` (`:1123`) and `foundation-gate` (`:1184`) die as candidates — see §10.1 |
| R-04 | 3 | DR-073/DR-107 escalation thresholds were fitted to the prior generation | `registry.yaml` DR-073 (*"MC Phase-2 WO-07-005 churned 4 gate cycles"*); `pandacorp-build.js:696-703` `if ((wo.reopen_count \|\| 0) >= 1) return 'opus'`; `:71` `MAX_REOPENS = 3`; DR-107 (*"80% of first-gate fails had ≤6-min fixes"*) | DR-073 (2026-06-21) / DR-107 (2026-07-01) | mechanism stands; threshold re-tuning is an open question with no Claude-5-era telemetry to decide it |
| R-27 | 5 | Claude Code's own OTel `cost.usage`/`token.usage` could independently cross-check the counter the factory already calls untrustworthy | the factory hand-rolls `~/.claude/dashboard-events.ndjson` (`CLAUDE.md:34`) via `emit-event.sh` on `SubagentStop` (`plugin/hooks/hooks.json:82-87`); `factory/standards/observability.md:12,54,61` discusses OTel **only** for product apps | DR-070 already declares the in-engine counter unreliable alone | stands as a complement, not a replacement |

### (i) Tools vs factory — thesis **STANDS, and this was its strongest area — until the primary sources were checked**

41 tools/features surveyed. The factory uses the big ones well (Workflow, `/loop`, `Monitor`, `PushNotification`, worktrees, Agent Skills, Claude Design, plugin validate) and correctly declined others with reasons on file (Agent Teams, hard `PreToolUse` blocks, ntfy, `--dangerously-skip-permissions`). But this is also the area where three of the headline adoptions were refuted by the very docs they cited (§10.1).

| id | Cat | Finding | Evidence | Origin | Verdict |
|---|---|---|---|---|---|
| R-19 | 5 | Housekeeping hooks block session start synchronously when a native `async: true` exists | `plugin/hooks/hooks.json:6-19` — `backup-pandacorp-state.sh` (timeout 30) + `rotate-events.sh` (timeout 15), neither `"async": true`; **plus** `.claude/settings.json:14-31` adds three more synchronous SessionStart hooks (10 + 30 + 30 s) ⇒ **~115 s worst case**, not ~45 s | none | stands, and strengthens |
| R-20 | 5 | `PreCompact` is unused, leaving a real uncovered window for DR-047 lesson capture | `plugin/hooks/hooks.json:3,21,57,81` wires **4 of 33** documented events; `capture-lessons-reminder.sh` is `Stop`-only (`:67-72`) | DR-047 rule 8 | stands — add, don't relocate |
| R-21 | 5 | `WorktreeRemove` is unused; the equivalent check exists only as an owner-run script | `plugin/templates/shared/.pandacorp/pending-work.sh:2-12` unions surviving worktrees with `git branch --no-merged` — only when the owner runs it | DR-096 §7 | stands as a **soft warning**; a hard block dies (`registry.yaml:574`) |
| R-22 | 5 | The bundled `fewer-permission-prompts` skill is unused; the allowlist is hand-maintained | `.claude/settings.local.json:1-55` authored by hand during an incident (`LESSON-0119`); 0 references to the skill anywhere | none | stands, and is **more** important after §10.1's permission correction |
| R-18 | 5 | The scheduled-routine permission workaround rests on an unverified flag and a malformed question | `.claude/settings.local.json:1-55`; `factory/decisions/registry.yaml:107`; `plugin/docs/routines.md:3-4` — routines are **Desktop scheduled tasks**, whose permission handling the docs call *"configurable per task"* | BL-0054, BL-0085 (both open), LESSON-0119 — **three records of one failure class** | downgraded + retargeted: **`dontAsk` + allowlist, explicitly not `auto`** |
| R-17 | 5 | `/goal` was proposed as a partial replacement for the hand-rolled supervisor | `plugin/skills/implement/SKILL.md:70,77,91` | the supervisor contract (`build-orchestration.md:752-786`) | **dies as a heartbeat or termination substitute** (§10.1); downgraded to an optional turn-continuation nudge, **impact H → L** |
| R-26 | 5 | The OS-enforced Bash sandbox is unused; only a `permissions.deny` list guards the Claude side | `.claude/settings.json:3-8` — 4 deny rules (`rm -rf`, `git push --force`, `git push -f`, `gh repo delete`), no sandbox config; the only "sandbox" hits in the repo are the unrelated Codex `workspace-write` mode | none | stands — orthogonal to, not a replacement for, `block-dangerous.sh` |
| R-28 | 5 | `.claude/rules/` path-scoped rules unused; 33 standards (~5,500 lines) are injected wholesale | no `.claude/rules/` directory exists (verified); `factory/standards/build-orchestration.md` alone is 1,360 lines | touches DR-051 ("rules-as-files") | stands as "needs design review", not a blind swap |
| R-25 | 5 | Agent frontmatter `effort:` is used; `experimental.cacheTtl` / `maxTurns` / `background` are not | 9 of 14 agents set `effort:`; none sets `cacheTtl` | none | open question — and possibly **unreachable**: workflow agents fall outside the main cache bucket (5 min default), controlled by the `subagentPromptCacheTtl` **setting** `[UNVERIFIED which applies]` |
| R-23 | 5 | `/deep-research` is unused; `discover`/`spec`/`architecture` hand-roll multi-source web research | `plugin/agents/researcher.md` + `plugin/skills/discover/sources.md` (68 lines of hand-rolled playbook) | none | stands as a spike |
| R-62 | 5 | Artifacts are used zero times; design surfaces are served by local `python3 -m http.server` | `.claude/launch.json:4-11` serves `mission-control/prototype` on :4000 and `:16-23` serves `mission-control/docs/design` on :4180; Artifact tool: 0 uses | none | stands, **citation corrected** — the mockup-path claim was wrong |
| R-24 | 5 | Cloud Routines unused — all recurring jobs are local `/loop`, which needs the laptop awake | `plugin/skills/review-launch/SKILL.md:3,34`; `plugin/skills/memory/SKILL.md:3,14` | none | stands as "wait"; the maturity label is `[UNVERIFIED]`, and *"runs autonomously / no permission prompts"* is a stronger caution than immaturity |
| R-63 | 5 | `claude plugin eval` could give the 26 skills a regression harness `validate` does not | `CLAUDE.md:19` uses `claude plugin validate plugin/`; no reference to `claude plugin eval` anywhere | none | **blocked** — `[UNVERIFIED]`, scope no work until confirmed |

---

## 6 · Improvement catalogue

All surviving R-ids, one row each, exactly one category each. **Rejected items are not here — they are in §10.** Rows whose recommendation verb is *simplify / trim / extract / narrow / correct / de-version* are the **prune-and-simplify set: 11 rows** (R-02, R-06, R-07, R-08, R-31, R-40, R-44b, R-46, R-52, R-53, R-60) — compare with §9's 28 items.

| id | Area | Cat | Recommendation | Evidence | Impact (why) | Effort | Risk | Red-team result | Landing | Canary |
|---|---|---|---|---|---|---|---|---|---|---|
| **R-01** | b,d,f | 6 | **File BL, sequenced after R-30.** If Codex is kept: re-map MECH→`gpt-5.6-luna`; note STANDARD/JUDGE→`gpt-5.5` ($0.88) is cost-inverted against `gpt-5.6-sol` ($0.624) and `terra` ($0.352). The fix is **one JSON edit + two prose edits + a regen** — `generate-codex-agents.mjs:109-113` builds the map from `model-tiers.json`, so the TOML follows | `plugin/runtime/model-tiers.json:5`; `.codex/agents/tier-mech.toml:3` `model = "gpt-5.4-mini"`; `agent-portability.md:44`; `AGENTS.md:89`; `RuntimeComparison.tsx:91` | **H** — a dispatch to a retired id hard-fails, blocking any Codex use | S | Low; deferring is safe only because Codex is dormant | stands (4 operative pins + 1 MC diagram verified); fold in R-74 | `BL-*` + `learn` | Dispatch one `tier-mech` Codex agent and confirm it resolves; today it should 400/404 |
| **R-02** | d | 6 | **Simplify + re-run.** (a) De-version the prose to the neutral MECH/STANDARD/JUDGE vocabulary PORT-2 already uses; (b) file a BL to re-run a DR-114-style fresh-context PROMPT-6 pass over 14 agents + 26 skills against Claude 5 | `prompting-conventions.md:5-6,48`; `registry.yaml:661`; `rule-registry.md:149-151,161` (PROMPT-1..7 registered, PROMPT-5 wired) | **H** — a stale premise sits inside a `MUST`-tier standard with real gates | M | Low — PROMPT-4/6 require the never-degrade list survive verbatim | stands, downgraded to "re-run, not remove". **The de-version edit is itself a PROMPT-6-governed prompt edit and must ship with its own fresh-context receipt** | `BL-*` + `learn` | Run PROMPT-6's fresh-context verifier on `reviewer.md` + `designer.md` under Claude 5; diff trigger/compliance vs the 2026-07-04 baseline |
| **R-03** | c | 3 | **Re-measure with DR-100's own methodology. Do not loosen speculatively** | `build-orchestration.md:53-68` (*"Target ~25–50 min / ~1.5–4k LOC per WO… Ceiling — split above ~4k LOC / ~45 min"*) | **M** — fewer WOs → fewer gate cycles → the fixed ~9-min gate cost amortizes better `[expected, not demonstrated]` | M | Medium — blind loosening reproduces the 7k-LOC WO that took 5 gate attempts / 20 h | stands as recalibration; blind removal dies — nothing about a better model stops an over-coarse WO exceeding a reviewable diff | `BL-*` → `learn` once data exists | One real `powerful` build with the ceiling at ~8k LOC/70 min on a fresh project; compare gate-reject rate + wall-clock to the DR-100 baseline |
| **R-04** | d,h | 3 | **Keep the mechanism; re-tune the threshold only with data** | `pandacorp-build.js:696-703,71`; `registry.yaml` DR-073/DR-107 | **M** — 3× cost per escalation, unknown firing rate | M | Low if left alone | stands (mechanism). "A smarter Sonnet 5 worker escalates less often" is `[expected, not demonstrated]` | `BL-*`, owner-decided | Compare the `reopen_count` distribution across the next N Claude-5-era FRD gates vs the DR-107 baseline before touching `MAX_REOPENS` |
| **R-05** | b | 3 | **Re-tier UP haiku → sonnet, OR replace the inference with a deterministic `severity → tier` lookup** | `pandacorp-backlog.js:87-91`; `conventions.md:48` | **M** — decides which model implements every future BL item | S | Low — `merge` re-validates with `validate-backlog.sh`, so a wrong tier wastes tokens, never corrupts state | stands, **evidence re-labelled**: `LESSON-0076` records a cheap-tier subagent returning a **stale inventory fact**. The scan returns inventory facts (`id`, `path`, `status`) `[demonstrated]` **and** infers a tier `[expected, not demonstrated]`. LESSON-0076 is `status: candidate`, `promotion: none`, `confidence: medium`, `times_applied: 0` — leaning on it as settled is what CONV-13 exists to stop. Cost **+$0.156/scan** | `BL-*` | Run the scan over the current `BL-*` set with haiku vs a deterministic table; diff the tiers; investigate mismatches |
| **R-06** | b | 6 | **Simplify — documentation only.** Add one row/footnote to PORT-2 naming the `sonnet`+`effort:high` hybrid | `analytics/devops/librarian/security-auditor` frontmatter; `generate-codex-agents.mjs:106-123`; `agent-portability.md:38-53` | **L** — clarity only | S | None | stands as doc-only. "Raise STANDARD's effort to high factory-wide" **dies**: the 5 plain-sonnet agents are high-volume build-loop workers where effort compounds per WO; the 4 hybrids run once per phase | `learn` | n/a |
| **R-07** | b | 6 | **Simplify** — PORT-2 says Codex MECH effort is "minimal/low"; the generator only emits "low". One-line doc edit; fold into R-06 | `agent-portability.md:44` vs `model-tiers.json:5` | **L** | S | None | stands | `learn` (fold into R-06/R-01) | n/a |
| **R-08** | b | 6 | **Simplify — one-line pointer** in the three worker `.md` files ("the build engine may escalate this to opus per DR-073"). Note the cross-runtime asymmetry: Codex TOMLs are fixed, so on Codex `backend-dev` really *is* always `gpt-5.5` | `pandacorp-build.js:700-703,770,772,782`; `backend-dev.md:5` | **L** | S | None | stands (all line numbers verified exact) | `learn` (agent prose is DR-114-governed) | n/a |
| **R-09** | b,h | 3 | **Owner decision**: a one-line engine fix (tests for a hard WO get the same rigor) or a one-line comment recording the asymmetry as intentional | `pandacorp-build.js:768` `model: P.worker` vs `:770,:782` `model: woModel, effort: woModel === 'opus' ? 'high' : undefined` | **M** — the asymmetry is **double**: the implementer gets both the opus escalation and an effort bump; test-writer gets neither | S | Low | stands as a question, not a change | `BL-*` after the owner answers | Re-run one `difficulty:high` WO with test-writer escalated; compare gate outcome |
| **R-10** | b | 3 | **Do not act.** Surface as owner question §12.7 only | `reviewer.md:9`; `registry.yaml:83` | — (no action) | — | — | dies as an action item, survives as a question — acting would break strict runtime locality (`agent-portability.md:11`) | none | n/a |
| **R-11** | h | 3 | **Scoped canary before any change** — move **only** `diagnose` (`:1417`) and `revert` (`:1169`) to sonnet-5 on ONE project | `pandacorp-build.js:1417` (`agentType: 'pandacorp:reviewer'`, read-only classification), `:1169` (git surgery) | **L** (was M) — call-*site* share ≠ frequency share; on a healthy build these sites' opus share rounds to zero | M | Medium — they fire on the failure path, degrading exactly the recovery machinery DR-117 exists for | **downgraded hard.** `gate-test-repair` (`:1123`) and `foundation-gate` (`:1184`) removed — see §10.1. Cost basis −$0.468/call computed correctly | `BL-*` (canary), then `learn` | Run one project with the two sites re-tiered; compare convergence rate and reopen count to the prior baseline. **Gated on R-12** |
| **R-12** | h | 6 | **File BL.** Minimal shape: derive a per-run rollup from `agent_transcript_path` and append one `usage_summary` line to `.pandacorp/track.jsonl` (durable, per-project) — **not** to the deliberately-slim `dashboard-events.ndjson` | `pandacorp-build.js:177-198`; `frd-12-observability-dataviz/frd.md:62,66` | **H** — R-03, R-04, R-11, R-13 and R-56 are all unfalsifiable without it | M | Low | stands. Respect the E5 "slim payload" precedent. `[UNVERIFIED]` whether the `SubagentStop` payload carries usage — **no usage field was found in 6,621 inspected event lines**, so the transcript-derived path is the likelier one | `BL-*` | Instrument one build; confirm a per-run rollup lands in `track.jsonl` without widening the event stream |
| **R-13** | h | 6 | **Recalibrate once R-12 lands**, and re-anchor `LESSON-0176` | `pandacorp-build.js:141`; `docs/proposals/12-adaptive-repair-and-model-selection.md:85`; `LESSON-0176` (`agent-inferred`, `confidence: medium`, `times_applied: 0`) | **M** — the brake is not badly wrong (2.5× vs 3×), but the `~10×` claim in memory is unsupported | S (after R-12) | Low | stands | `BL-*` (depends on R-12) + `memory` | Compare measured opus/sonnet spend on one build against `COST()`'s assumption |
| **R-14** | c,h | 5 | **Measure, don't touch.** Re-test `budget.spent()`'s subagent accounting on the current platform; only then demote `agentSpawned` to a secondary check — **never remove it** | `pandacorp-build.js:47-48,67,141`; `build-orchestration.md:487-491` | **L** urgency, **H** if mishandled | S (a measurement) | High if swapped speculatively — recreates the 2026-06-17 incident | downgraded to "measure, don't touch". The Category-2 half (`maxAgents` stays primary) is **not** proposed for change | `BL-*` | A `powerful` targeted build with `maxAgents` unset and `maxSpend` at a known ceiling: does `budget.spent()` now track actual subagent spend? |
| **R-17** | i | 5 | **Optional, narrow.** `/goal` as a turn-continuation nudge in an **attended** session only. It substitutes for neither the heartbeat nor the termination judgement | `implement/SKILL.md:70,77,91`; `docs/en/goal` | **L** (was H) — it would delete perhaps two sentences of a ~40-line contract | S | Low as scoped | **dies as the proposed adoption** (§10.1); survives only in this narrow form | `BL-*` (optional) | On one supervised build with `maxFrds 1`, set `/goal "the run has ended with phase: release or a BLOCKED reason recorded in status.yaml"` **alongside** the existing supervisor; record (a) how many times the evaluator ran while the Workflow was in flight, (b) whether any check-in was delivered between minute 30 and the run's end. **Docs predict (a) ≈ 0, (b) at most one. If that holds, close R-17 permanently** |
| **R-18** | i | 5 | **Set the scheduled tasks' own permission configuration to a deny-by-default posture (`dontAsk`), keep and grow the allowlist, and explicitly do NOT enable `auto`** | `plugin/docs/routines.md:3-4` (routines are Desktop scheduled tasks, *"Permission prompts: Configurable per task"*); `.claude/settings.local.json:1-55`; `registry.yaml:107`; BL-0054, BL-0085, LESSON-0119 | **H** — addresses a failure class recorded three times | S | Medium — `dontAsk` makes the allowlist the **entire** permission surface, so R-22 becomes a **dependency**, not an alternative | **downgraded + retargeted.** `--permission-prompts none` is `[UNVERIFIED]` — absent from `docs/en/headless`; routines do not run via `claude -p`; `auto` is a per-action classifier that **widens** approval with nobody present, and BL-0035's root cause is UNKNOWN | `BL-*` | Fire `pandacorp-memory-review` once under the new posture; confirm a genuinely new tool call fails **loud**, not silent |
| **R-19** | i | 5 | **Adopt.** Mark the two housekeeping SessionStart hooks `"async": true`; keep safety hooks synchronous | `plugin/hooks/hooks.json:6-19`; `.claude/settings.json:14-31` | **M** — pure latency: **~115 s** worst case in the factory repo, not ~45 s | S | None — async changes *when* the side effect completes, not whether it runs | stands, and strengthens. Pair with R-69 | `BL-*` | Time-to-first-prompt across 3 sessions before/after |
| **R-20** | i | 5 | **Adopt** — add a `PreCompact` hook running the same lesson-capture check. **Add, don't relocate**: keep the `Stop` backstop | `plugin/hooks/hooks.json:3,21,57,81` (4 of 33 events); `:67-72` | **M** — a genuine uncovered window for DR-047 | S | Low | stands. **Note it is net-new machinery, not a replacement** — sequence after Phase 0 | `BL-*` | Trigger a compaction mid-session after an owner-correction event; confirm the reminder fires *before* compaction completes |
| **R-21** | i | 5 | **Adopt as a soft warning**, not a hard block | `plugin/templates/shared/.pandacorp/pending-work.sh:2-12`; precedent at `registry.yaml:574` | **M** | S | Low | stands; a hard deny dies | `BL-*` | Create a worktree with an unmerged branch; attempt removal; confirm a visible warning fires |
| **R-22** | i | 5 | **Adopt** — run `fewer-permission-prompts` on a cadence (fold into the `memory` review job) so the allowlist stays current | `.claude/settings.local.json:1-55`; 0 references to the skill in the repo | **M**, raised — under R-18's `dontAsk` posture the allowlist is the whole permission surface | S (bundled, zero build cost) | Low — it proposes; the owner reviews | stands, and is now a **prerequisite of R-18** | `BL-*` | Compare the generated allowlist against the hand-authored one; owner reviews the diff |
| **R-23** | i | 5 | **Spike, do not adopt blind** — does `/deep-research`'s cited-report format fit the idea-card schema `discover` already produces? | `plugin/agents/researcher.md`; `plugin/skills/discover/sources.md` | **M** | M | Low | stands as a spike; neither adopted nor rejected before | `BL-*` (spike) | Run `/deep-research` on one real `discover` lens; compare output shape to the current card schema |
| **R-24** | i | 5 | **Wait.** A genuine gap for "a factory that runs unattended overnight" | `review-launch/SKILL.md:3,34`; `memory/SKILL.md:3,14`; 1-hour minimum interval | **M** | M | Medium | stands as "wait". **Tag the "research preview" maturity claim `[UNVERIFIED]`** — and note *"runs autonomously / no permission prompts"* is a stronger reason for caution under BL-0035 than immaturity is | owner decision | n/a |
| **R-25** | i | 5 | **Open question, do not assert a gap.** Read `LESSON-0176` first | 9/14 agents set `effort:`; none sets `cacheTtl` | **M** if reachable | S | Low | downgraded. **Harder fact:** workflow agents *"fall outside the main conversation's cache TTL bucket… five minutes by default"*, and the lever is the **`subagentPromptCacheTtl` setting**, not per-agent frontmatter — so the `implementer` idea may not be reachable from frontmatter at all. `[UNVERIFIED]` which knob applies | `BL-*` only after reading LESSON-0176 | Compare cache hit ratio (`/usage` per-session prompt-cache line) across one FRD with 5 m vs 1 h TTL |
| **R-26** | i | 5 | **Adopt as an orthogonal layer** — OS-level Seatbelt catches what a command-pattern denylist misses | `.claude/settings.json:3-8` (4 deny rules, no sandbox config) | **M** | S to enable / M to verify | Medium — must confirm the engine's legitimate file/network access isn't blocked | stands. Orthogonal to, **not** a replacement for, `block-dangerous.sh`. **Net-new machinery** — sequence after Phase 0 | `BL-*` | Enable `/sandbox` in a throwaway session; run one full `/implement` on a disposable project; confirm nothing legitimate is blocked |
| **R-27** | i,h | 5 | **Adopt as a complement, not a replacement** — the hand-rolled stream carries factory-domain events (FRD verified, WO commit) generic OTel metrics don't know about | `CLAUDE.md:34`; `plugin/hooks/hooks.json:82-87`; `observability.md:12,54,61` | **M** | M | Low | stands — DR-070's own pattern is "validate the internal counter against an external source". **Net-new machinery** — sequence after R-12 | `BL-*` (link to R-12) | Enable OTel for one build; compare `claude_code.cost.usage` against `agentSpawned × COST()` |
| **R-28** | i | 5 | **Design review, not a blind swap.** Path-scoping could load `build-orchestration.md` only when editing the engine | no `.claude/rules/` directory (verified); `build-orchestration.md` is 1,360 lines | **M** (context-budget win) | M | Medium — restructures an established injection mechanism (DR-051) | stands as "needs design review" | `docs/proposals/` | n/a |
| **R-29** | a,i | 5 | **Trial in ONE skill (`decide`) only.** Do **not** apply to `design`'s open-ended visual feedback or `explore`'s conversation | 0 hits across `plugin/skills/*/SKILL.md`; `agent-portability.md:65` already defines the fallback | **M** (fidelity on the highest-stakes gates) `[expected, not demonstrated]` | S per skill | Low | downgraded to a single-skill trial. The "it reduces portability" objection is **factually wrong** — PORT-3 already translates it — but the gain is unproven and prose gates carry rationale a fixed option list cannot | `BL-*` (scoped to `decide`) | Run `/pandacorp:decide` with structured questions on a real pending-decision file; owner judges whether choice capture improved |
| **R-30** | f | 6 | **Owner decision, options A–D (§12.1).** Recommendation: **(B) freeze or (D) narrow** — and (D) only once R-73's prerequisite is met | 30 Codex commits, all 2026-07-04..15, 0 since; `claude-code-review-report.md:278` | **H** — gates R-01, R-31, R-33 and ~4,800 net added lines across 43 files | S to decide | Deciding wrong costs the status quo's own cost | stands. **Correction:** the independent reviewer *named* the split as one of two options inside an open question and its formal R11 verdict was **MODIFY** (`:234`), not drop — and it supplied a reopen trigger, which makes freeze strictly better than drop | owner → `learn` | Before any further R10/R11 spend: one bounded **real** (not fixture) `attended_foreground` build on a genuine small FRD, scored for whether Codex's JUDGE-tier review caught anything `pandacorp:reviewer` missed |
| **R-31** | f | 6 | **Simplify, conditional on R-30.** The drift *gate* stays if the mirrors stay; the debate is the §13.1 "every future change" mandate | `agent-portability.md:222,225-226`; `hooks.json:71-77`; `README.md:879-902` | **M** (friction on every skill/agent change) | S (a scope note) | Low | downgraded — proportionate only if the capability is kept | `learn`, tied to R-30 | n/a |
| **R-32** | f | 6 | **File BL** (sibling of BL-0084) | `CLAUDE.md:15` vs `AGENTS.md:98` and `agent-portability.md:84-121` | **L** — informational; AGENTS.md remains correct and CLAUDE.md defers to it | S | None | stands | `BL-*` | n/a |
| **R-33** | f | 6 | **Triage as a batch after R-30**, not piecemeal via `implement-backlog` | BL-0030/0031/0032/0044/0065/0070/0071/0080/0084 | **M** (9 items × cost) | S to triage / L to implement | Medium — **BL-0030 is the hook-portability gap; do not casually drop it** (see R-73) | downgraded from "close them" | owner → `implement-backlog` or a documented "won't fix, superseded" | n/a |
| **R-34** | f | 6 | **Record the evidence balance honestly in the decision log** before further investment | `factory/decision-log.md:672-676`; `BL-0035-*.md:23-27`; `LESSON-0067` | **H** for the decision | S | None to record honestly | stands, **title softened**: the one dated write-capable Codex run *coincides in time* with an unexplained deletion; root cause UNKNOWN, three unranked candidates. It is a risk-tolerance input, not proof | `factory/decision-log.md` entry | (see R-30) |
| **R-35** | e | 6 | **Prioritize — all three are S effort.** Fix **BL-0090 first**, then BL-0088, then BL-0089 | BL-0088 / BL-0089 / BL-0090; `LESSON-0147`, `LESSON-0152` carry `approved` + `candidate` | **H** — these break the loop this whole audit is testing | S each | Low — owner-stated is already the top trust tier | stands. "Backlog noise, ignore" dies | `factory/backlog/` (all three exist) | After the fix, confirm the 10 owner-stated candidates flip to `active` |
| **R-36** | e | 6 | **Promote `LESSON-0113` via `learn` + owner — for the 3 genuinely untracked instances** (R-43, R-47/R-48, R-12) plus R-72's new one | `LESSON-0113-*.md:6-8,11-12` | **M** (was H) — the existing loop **already caught 6 of 11**; what failed is closing, which a MUST-check does not address | S (rationale already written) | Low | stands as a promotion, **downgraded and demoted from Top-10 #1**. State plainly that the loop's *detection* half works | `learn` + owner | n/a |
| **R-37** | e,i | 6 | **Promote — but only after R-71 resolves the contradiction** | `LESSON-0096-*.md:8,19-36`; `_inbox.md:462-474` | **M** | S | **Raised: promoting it as written would codify a rule the factory's largest skill violates** | stands as a promotion; **no longer a Phase 0 "cheapest high-value fix"** | `learn` | Resolve R-71 first |
| **R-38** | e | 6 | **Owner decision**: clear the 13-item queue in one `learn` sitting vs one at a time | live `grep` → 13, range 2026-06-30 → 2026-07-24 | **M** | M | Low | stands | `learn` + owner | n/a |
| **R-39** | e | 6 | **No action — re-measure after more projects** | 7 agents wired; `applied_in` non-empty on 10 of 177 | **L** | — | — | downgraded from "retrieval is decorative" to "insufficient project volume to judge" | none | If a 4th/5th project ships with **zero** citations of an `active` lesson whose trigger clearly matched, that is the canary |
| **R-40** | d | 6 | **Simplify** — replace the hardcoded sentence with a derived note, or add a ~5-line `awk` recount to `check-standards.sh` (fold into R-41) | `rule-registry.md:159-161` (claims 138/31/106/1) vs live `awk` (137/31/105/1) | **L** | S | None | stands, independently verified twice. **The recount must exclude the ~5 non-rule table rows a naive leading-pipe grep picks up** (raw count 143) | `BL-*` (MECH tier) | `check-standards.sh` recomputes and asserts the count |
| **R-41** | d | 6 | **Action the existing BL**: add the two missing registry rows and give the checker a trigger | live run this session: two `FAIL` lines; `BL-0055-*.md:6` `status: open` | **M** | S | None | stands — verified live, not from memory | `factory/backlog/BL-0055` | Re-run `check-standards.sh`; expect GREEN |
| **R-42** | d | 6 | **File BL** — a Biome/import-graph rule for barrel imports in hot paths is mechanically checkable | `rule-registry.md:69,157` | **L** | S–M | None | stands — the registry already self-diagnoses the fix | `BL-*` | The lint rule fires on a seeded barrel import |
| **R-43** | a,c | 6 | **File BL**: either wire `check-preflight-drift.sh` into `check-derived-drift.sh`'s Stop sequence, or mark it explicitly manual-only in its header | `plugin/docs/decision-log.md:718,722`; `BL-0042-*.md:55`; script usage line `:37` | **M** — it is the *enforcement half* of a fix elsewhere called "already proven" | S | None | stands. This resolves an inter-auditor contradiction: the byte-identical-copies **design** is right; its "mechanically verified" **claim** is currently false | `BL-*` | With the script wired, deliberately diverge one A1 span and confirm the Stop gate REDs |
| **R-44** | c | 6 | **Keep both BLs flagged as blocking any confident "DR-117/118 works" claim.** No new item needed | `BL-0063-*.md`, `BL-0069-*.md` (both open) | **H** — `gateConverge` is a ~140-line, 5-branch state machine, the highest-risk-of-silent-bug code in the engine | L (BL-0063 is itself a project) | The next unattended overnight run is the first genuine test — exactly what BL-0063 warns against | stands — predates the model-generation question entirely | `factory/backlog/` (both exist) | — (this finding *names* the missing canary) |
| **R-44b** | c | 6 | **Simplify** — one clarifying sentence distinguishing "offline coverage" from "an offline seam against the real engine" | `plugin/docs/decision-log.md:744` (*"the offline harness"*, 54 scenarios) vs `BL-0063` (*"zero engine tests, confirmed"*) three days later | **L** | S | None | stands | `BL-*` (fold into BL-0063) | n/a |
| **R-45** | c | 6 | **Prioritize** — the highest-severity open engine item, central to `gateConverge` | `BL-0051-*.md` (p1, open since 2026-07-07); links LESSON-0002, DR-080 | **H** | M | — | stands. **Note:** the `gate-test-repair` adjudicator at `pandacorp-build.js:1123` exists to arbitrate exactly this deadlock — which is why it must not be re-tiered down first (§10.1) | `factory/backlog/BL-0051` | — |
| **R-46** | c | 6 | **Narrow the scope-gate** as part of resolving BL-0082 — skip when this session's edits touched no `plugin/` path | `hooks.json:73-78`; BL-0082 (open) | **M** | S | Low — must not weaken the derived-artifact integrity property itself | stands as a scope fix; removing the check dies (Category-2 integrity gate). It narrows *when* the gate runs, never *whether* | `factory/backlog/BL-0082` | Two parallel sessions, one editing `plugin/`; confirm the innocent one's Stop is no longer red |
| **R-47** | g | 6 | **File BL** — rename one string (or add an alias) | `skill-flows.ts:417`, `:1229-1231`; `SkillDetail.tsx:158-159` | **M** (one of ~24 skill pages degraded) | S | None | stands — reproducible drift, a live DR-046 violation | `BL-*` | Load `/configuration` → Architecture card; assert the diagram renders and the explainer is Spanish |
| **R-48** | g | 6 | **Add a guard** — a test enumerating `plugin/skills/*` dirs, asserting `getSkillFlow(dirname)` is defined or the slug is on an explicit "no flow yet" allowlist | `skill-flows.ts:9-11`; R-47 is the proof it decays | **M** | S | None | downgraded from "remove the hand layer" — the curated Spanish explainer is real value under CONV-11/DR-110 | `BL-*` (sibling of `BL-0041-ssot-diagram-drift-test.md`) | Rename a skill dir in a fixture; confirm the test REDs |
| **R-50** | g | 2 | **Surface the number; do not prescribe a cut** | `git log` 900/1,172 (76.8%); gamification ≈ 20,308 of 182,490 src lines; `factory/portfolio.md:8` | **M** as information | S | None | "cut MC investment" downgraded to "show the owner the ratio"; **"cut gamification" dies** — the only memory evidence bearing on it says the opposite | owner (§12.3) | n/a |
| **R-51** | g | 6 | **Keep open as filed** — this audit adds corroboration only | `BL-0062-*.md` (open 2026-07-10) | **M** (silent misdirection to the wrong decision) | M | Low today, grows with each heading-format edge case | stands as filed; `[expected, not demonstrated]` — no divergence observed yet | `factory/backlog/BL-0062` | A golden-file test: one `decisions.md` fixture through both implementations, asserting identical ids |
| **R-52** | a | 6 | **Extract** the four-planes table to a shared reference **and** add an explicit "read it before step 0" instruction | `AGENTS.md:44-50` vs `learn/SKILL.md:16-21`, `memory/SKILL.md:33-36`, `absorb/SKILL.md:62,89-93` | **L** | S | Low — no fail-closed gate keys on this exact phrasing (unlike DR-045) | stands as downgraded: a pointer is only followed when the skill says to follow it (the `canvas-procedure.md` precedent) | `BL-*` | n/a |
| **R-53** | a | 6 | **Trim `absorb`'s inline CONV-12 restatements to a pointer** | inline: `absorb/SKILL.md:45,105`; good pointer: `implement-backlog/SKILL.md:52` | **L** | S | Low | stands with the **citation corrected** — `learn/SKILL.md:43` is dropped from the recommendation; that line is the DR-116 supersession step and CONV-12 appears only as a rationale for delegating a grep | `BL-*` | n/a |
| **R-54** | a | 3 | **Test first, keep meanwhile** | `implement-backlog/SKILL.md:45` — no BL/DR id, no date | **L** | S | **High if removed blind** — a silent wrong-repo write is an MC-scale incident class | downgraded from "re-tier down" to "verify, don't remove" | `BL-*` | **Rewritten (cheaper):** run the **Scan phase only** (read-only, no worktree, no merge) from a sibling repo's cwd, once with and once without the ANCHOR preamble; assert every returned `path` is absolute under `FACTORY_ROOT` |
| **R-55** | a | 3 | **Keep the ordering; revisit only the threshold, and only with an owner number** | `memory/SKILL.md:15`; `spec/SKILL.md:29` | **L** | S | Low | downgraded: deleting the passage **dies** — GOLD-first is a prioritization argument, not a context-size one, and "lost-in-the-middle" is a retrieval-fidelity effect that persists in long-context models `[expected, not demonstrated]` | none without an owner number | n/a |
| **R-56** | a,c,h | 3 | **Keep as-is; measure, don't move** | `implement/SKILL.md:108`; `pandacorp-build.js:822` — `useSplit` is true only when `reviewSplit` is on **and** (`priorAttempts >= 1` or something was reopened), i.e. **serial-first**, engaging only on a re-gate; `:824-830` budget pre-check; `:983` closer drops xhigh→high | **M** | M | High if narrowed wrongly | stands (keep). The split is already serial-first, so its expected cost on a healthy build is near zero — which is also why "widen it to cheaper modes" has almost no upside. Both the widen and narrow arguments are `[expected, not demonstrated]` | none for now; `learn` if the owner funds the comparison | On the next batch of re-gates, run half split / half forced-serial; compare defect-escape rate at close-out. **Needs N ≥ 6 re-gates to mean anything** — run it once and it will be over-read |
| **R-57** | b | 4 | **Do not change now — scope as its own proposal** | `analytics.md:18`, `backend-dev.md:16`, `frontend-dev.md:25`; none lists `Agent`/`Task` in `tools:` | **M** if real | M | Uncontrolled fan-out cost | stands as a proposal candidate, not a prompt edit. No LESSON/BL quantifies how often a *technical* (not product) gap costs a round-trip | `docs/proposals/` | n/a |
| **R-58** | T2 | 3 | **Watch, don't act.** The alias abstraction already absorbs the swap | `model-tiers.json:4` uses the alias `haiku`, not the dated id; retirement "not sooner than 2026-10-15" | **M** | S | Low — alias-based | stands as a watch item; "migrate now" **dies** — there is nothing to migrate. Two live consequences: MECH is the one tier where `effort:` cannot be raised, and MECH is capped at 200K context | none (monitor) | On the retirement date, confirm the `haiku` alias resolves to the successor without a repo edit |
| **R-59** | T2 | 2 | **Keep, and cite as the exemplar** for fixing R-01/R-02 | `model-tiers.json:4,8,12`; base Opus 4/4.1 and Sonnet 4 are retired and would hard-fail (400) if pinned | **H** (breakage avoided) | — | None | keep | none | n/a |
| **R-60** | d,h | 6 | **Keep the layer; correct the figure** wherever the stale 169 is repeated in owner-facing summaries | 9 `applies_when: always` files in `plugin/templates/rules/` = 289 lines | **L** | S | None | stands as a correction — a direct read of `clean-code.md` shows genuine engineering convention, not hand-holding | `memory` (freshness fix) | n/a |
| **R-62** | i | 5 | **Adopt (low priority)** — publish design mockups as Artifacts instead of a local HTTP server | `.claude/launch.json:4-11` (mission-control/prototype :4000) and `:16-23` (mission-control/docs/design :4180); Artifact tool: 0 uses | **L** | S | Low | stands with the **citation corrected** — the earlier claim that `launch.json` serves `docs/design/mockups/direction-{1,2,3}.html` is wrong; that path does not exist in this repo. Artifacts' single-page/no-backend model is correctly **not** used for Mission Control | `BL-*` | Publish one mockup set as an Artifact; owner confirms the review link is faster than the local server |
| **R-63** | i | 5 | **Blocked** — do not scope work until the capability is confirmed against a primary doc | `CLAUDE.md:19` uses `claude plugin validate plugin/`; no reference to `claude plugin eval` anywhere | **M** *if real* | M | — | stands as a gap note, not a greenlight. **`[UNVERIFIED]` carried forward** | none until verified | n/a |
| **R-64** | a | 2 | **Keep** (2 lines of insurance) | `scaffold/SKILL.md:11`; `spec/SKILL.md:14`; `plugin/docs/decision-log.md:717` (*"was silently dropping both"*) | — | — | — | keep — "lost in the relay" is a structural risk of prose-as-procedure, not obviously model-solved | none | Optional: a script asserting a fresh scaffold has non-empty `docs/rules/README.md` and `dev_port_base != 0` |
| **R-65** | a,c,d,g | 2 | **Keep across the board** | `implement/SKILL.md:174`; `memory/SKILL.md:38`; `AGENTS.md` PROTECTED STATE PATHS | — | — | — | keep — a more capable model executing an irreversible mistake faster is not an improvement | none | n/a |
| **R-66** | c,b | 2 | **Keep, no change** | `pandacorp-build.js:180-202,21-32,100-102,264-267`; `build-orchestration.md:713-714`; `prompting-conventions.md:33`; `reviewer.md:4,51-77` | — | — | — | **thesis dies here** — and §10.1 now *vindicates* the hand-rolled worktree machinery rather than merely tolerating it | none | n/a |
| **R-67** | e,c | 2 | **Keep** — no merge, no softening | `factory/memory/README.md:9-16`; `capture-lessons-reminder.sh:1-9,15-38`; `validate-memory.sh` → `prune-freeze: INACTIVE`; `894ca85d` proposed **zero** deprecations with a written justification | — | — | — | keep. "Native auto-memory now covers this" **dies on scope** — auto-memory is per-user, per-machine, uncommitted, Spanish; `factory/memory/` is committed, English, cross-clone, schema-gated | none | n/a |
| **R-68** | d,b,h | 2 | **Keep** | `debugging.md:70-72`; `memory-harvesting.md:105`; `conventions.md:57,51`; `pandacorp-build.js:67,71`; `registry.yaml:646` | — | — | — | keep | none | n/a |
| **R-69** | c,i | 6 | **NEW. File one BL** to decide which copy owns the session-start backup, and remove the other | `plugin/hooks/hooks.json:8` and `.claude/settings.json:20-25` run the same script | **M** — latency (folds into R-19) and a possible correctness question | S | Low | stands — found in the red-team pass, missed by every area audit | `BL-*` | Instrument both invocations; confirm exactly one runs after the fix |
| **R-70** | c,i | 6 | **NEW. Measure the Stop path before arguing latency anywhere else** | `plugin/hooks/hooks.json:57-79`: 300 + 15 + 30 = up to **345 s** synchronous per Stop | **M** | S (a measurement) | None to measure | stands — R-46 narrows only the third of the three Stop hooks; if latency is the argument for R-19, the Stop path deserves the same measurement | `BL-*` | Time 5 Stops in the factory repo; record the per-hook split |
| **R-71** | e,i | 6 | **NEW. Resolve the contradiction before promoting LESSON-0096 (R-37)** — either the lesson is over-broad, or the supervisor's timer rests on a documented misuse | `LESSON-0096-*.md:8` vs `implement/SKILL.md:70,77`; `docs/en/scheduled-tasks` names `CronCreate/List/Delete` as the general scheduling tools and mentions `ScheduleWakeup` only in the self-paced-`/loop` context | **H** for R-37's safety — promoting as written would codify a rule the largest skill violates | S to resolve | Low to investigate | stands as a **contradiction to resolve, not a proven defect** — the lesson is `agent-inferred`, `confidence: medium`, and the docs do not explicitly forbid the use | `BL-*`, blocking `learn` for R-37 | On one supervised build, confirm the ~2-min `ScheduleWakeup` heartbeat re-fires outside `/loop` for the full run without duplicate spawns |
| **R-72** | a,e | 6 | **NEW. File BL** — either point the two skills at `plugin/docs/routines.md`'s Desktop scheduled tasks, or say plainly that `/loop` is the attended-session form and the routine is the durable one | `memory/SKILL.md:3,14`; `review-launch/SKILL.md:3,34`; `plugin/docs/routines.md:3-4`; `/loop` recurring tasks **expire 7 days after creation** and are cleared by a fresh conversation | **M** — the two jobs the self-learning loop depends on advertise a mechanism that cannot deliver their contract | S | None | stands — a **12th** promise-without-mechanism instance, inside the very loop R-35/R-36 are about, and it is genuinely untracked | `BL-*` | Create one recurring `/loop` job; confirm it is gone on day 8 while the Desktop task survives |
| **R-73** | f | 6 | **NEW. Make BL-0030 a hard prerequisite of any narrow-to-reviewer decision** | `plugin/runtime/enforcement-policy.json:11` grants Codex `workspace-write`; PORT-5's review-only boundary is prose; **BL-0030 open, untouched since July** | **H** for §12.1's safety | M (BL-0030 itself) | **The "supported today with zero new engineering" claim is true only in the same sense PORT-6 was on 2026-07-04** — by instruction, with zero enforcement, which is the configuration that preceded BL-0035 | stands — this is a promise-without-mechanism instance **inside** the audit's own recommendation | owner → `factory/backlog/BL-0030` | With BL-0030 wired, attempt a write from a Codex reviewer session; confirm the hook blocks it |
| **R-74** | f,d | 6 | **NEW. Fold into R-01** — do not treat R-01 as net-new | `docs/proposals/30-factory-contradiction-sweep.md:108` (finding N3, "confirmed"); `AGENTS.md:89` still carries the stale Codex tier line | **L** on its own; **H** as evidence that "confirmed" findings sit unclosed | S | None | stands — a second data point that the factory's detection works and its closing does not | `BL-*` (fold into R-01) | `grep -rn "gpt-5\.4" AGENTS.md` returns nothing |

---

## 7 · Re-tier table — all 14 agents

Cost figures use §3.1's call-unit basis. **DR-114 rule 5 makes frontmatter pins governance-gated — none of these is an agent's silent edit.**

| Agent | Current pin (+ runtime override) | Proposed | Reason | Evidence / source | Canary | Cost delta basis |
|---|---|---|---|---|---|---|
| **architect** | `opus` + `effort: high` | **Keep JUDGE** | CONV-12's own textbook JUDGE example: *"architecture/blueprint decisions… expensive to unwind if wrong"* | `conventions.md:50`; `registry.yaml:644`; `architect.md:12-70` | n/a (matches policy verbatim) | $0 |
| **product-manager** | `opus` + `effort: high` | **Keep JUDGE** | Self-stated stakes: *"An ambiguous spec is the root cause of cascading errors downstream"* | `product-manager.md:45` | n/a | $0 |
| **designer** | `opus` + `effort: high` | **Keep JUDGE** | `[demonstrated]` MC shipped a UI that didn't match the approved prototype; root-caused to a missing anchor/gate, fixed at DR-054/055 cost | memory `mc-design-fidelity-failure.md`; `designer.md` | n/a | $0 |
| **reviewer** | `opus` + `effort: high` | **Keep JUDGE** | DR-015 makes "a different model from the generator" **structural**, not a quality preference | `registry.yaml:81-83`; `reviewer.md:9` | R-10's open question only; no unilateral change | $0 |
| **copywriter** | `opus` + `effort: high` | **Re-tier candidate → STANDARD, canary-gated** | Labels, error strings and empty states sit closer to CONV-12's "implementation / medium analysis" sonnet band than to "architecture / adversarial / open-ended synthesis". **No incident either way** | `copywriter.md` (26 lines); `registry.yaml:644` (deliberate placement) | Blind A/B: the same FRD's microcopy on sonnet-5 vs opus-5, owner-scored for voice/consistency | **−$0.468/call**; ~2–5 copy calls per project ⇒ **−$1 to −$2.30 per project**. Do it for tier coherence, not savings. Does **not** break DR-015 — copywriter is not in the generator/verifier pair |
| **analytics** | `sonnet` + `effort: high` | **Keep STANDARD** (hybrid effort load-bearing) | Implementation-adjacent, not architectural; the hybrid must never silently collapse to medium | `analytics.md:6`; `generate-codex-agents.mjs:116-123` | n/a | $0 |
| **devops** | `sonnet` + `effort: high` | **Keep STANDARD** | Its one irreversible action (prod deploy) is owner-gated by DR-004, not by model tier | `devops.md:16` | n/a | $0 |
| **librarian** | `sonnet` + `effort: high` | **Keep STANDARD** | The evidence-or-discard bar and A.U.D.N. dedup lean toward JUDGE, but no incident shows sonnet+high insufficient; the `+high` hybrid compensates | `librarian.md:30`; `registry.yaml:644` | Spot-check: has the librarian ever mis-classified a MERGE/contradiction? (**none found in this audit**) | $0 |
| **security-auditor** | `sonnet` + `effort: high`, `disallowedTools: Write, Edit` | **Keep STANDARD** | Checklist-driven and script-verified (`npm audit`, gitleaks) — pattern-matching more than open-ended judgment | `security-auditor.md:5,7,10` | n/a | $0 |
| **backend-dev** | `sonnet` — **runtime override: `opus` via `pickWorkerModel`** | **Keep STANDARD (floor)** | The `.md` pin is the floor; DR-073 escalates on `difficulty:high` or `reopen_count>=1` | `backend-dev.md:5` vs `pandacorp-build.js:700-703,770` | n/a — but land R-08's doc pointer | $0 (mechanism calibrated); see R-04 |
| **frontend-dev** | `sonnet` — same override | **Keep STANDARD (floor)** | Same | `pandacorp-build.js:772` | n/a | $0 |
| **implementer** | `sonnet` — same override | **Keep STANDARD (floor)** | Same. **Highest-volume agent** ⇒ the one plausible `cacheTtl` candidate (R-25), if the knob is reachable at all | `pandacorp-build.js:782` | R-25's cache-hit comparison | $0 on tier; cache TTL is a separate, unquantified lever |
| **test-writer** | `sonnet` — **no override (asymmetry)** | **Keep STANDARD — flag the asymmetry (R-09)** | Dispatched at `P.worker` **always**, so a `difficulty:high` WO gets an opus builder with `effort: high` and a plain-sonnet test author | `pandacorp-build.js:768` vs `:770,:782` | Re-run one `difficulty:high` WO with test-writer escalated; compare the gate outcome | **+$0.468 per escalated WO** if escalated in step |
| **researcher** | `sonnet` | **Keep STANDARD** | Matches CONV-12's own example: *"research/summarization fan-out"* | `conventions.md:49` | n/a | $0 |

**Non-agent re-tier (engine step), carried from R-05:** the backlog-scan step, `.claude/engines/pandacorp-backlog.js:91` `model: 'haiku'` → **sonnet, or a deterministic lookup**. Cost: **+$0.156 per scan call** (one per drain) — negligible against wrong-tier dispatch of a whole BL item.

### 7.1 The MECH/STANDARD/JUDGE mapping verdict

**The mapping is sound and should not be redesigned.** Its alias layer is the single best-aged piece of the factory (R-59). Three corrections, none structural:

1. **The Codex half of the same table is not alias-based and is now broken** (R-01). Fix by re-mapping, and check whether OpenAI-side aliases exist to prevent recurrence.
2. **A 4th de-facto tier exists and is unnamed** (R-06). **Verdict: name it in PORT-2 as a documented hybrid; do NOT promote it to a real fourth tier and do NOT raise STANDARD's default effort factory-wide.** The 5 plain-sonnet agents are high-volume build-loop workers where effort cost compounds per work order; the 4 hybrids run once per project phase.
3. **The definitions are correct but not consistently obeyed at the edges** — R-05 (haiku doing judgment) and R-11 (JUDGE sites doing bounded classification or git surgery) are **mapping-conformance** failures, not mapping-design failures.

### 7.2 The "4th tier" (`effort: high`) question

`effort` is a **second axis**, not a fourth tier, and it should stay that way. `effort` is a first-class frontmatter field (`low`/`medium`/`high`/`xhigh`/`max`), and the engine already uses `xhigh` at the serial FRD gate (`pandacorp-build.js:868`) and for `patch` (`:1104`), stepping down to `high` for the split-gate closer (`:983`). That is a deliberate 2-D policy: **model = capability class, effort = depth within it.**

- **Document the axis** (R-06/R-07): PORT-2 presents a 1-D table, which is why the hybrid is invisible and the "minimal/low" wording drifted from the code's single `"low"`.
- **Haiku cannot participate in the effort axis at all** — Haiku 4.5 uses the pre-4.6 "Extended" thinking API and the effort parameter is **"Not supported"** `[VERIFIED, §3]`. So the only way to add depth at MECH is to change model. This strengthens R-05: if a MECH step needs judgment, it must move to STANDARD; there is no "haiku + high effort".
- **`xhigh`/`max` are under-exploited on the Claude side**, but no evidence here supports raising them speculatively.

### 7.3 Haiku 4.5 retirement exposure

**Exposure: low, verified.** Retirement is "not sooner than 2026-10-15" — the nearest of any active model, ~6 weeks out. The factory pins the **alias** `haiku` (`model-tiers.json:4`), never the dated `claude-haiku-4-5-20251001`, so the swap should require **zero repo edits** (R-58). Two watch items when it lands: (a) the successor must be re-checked against R-05's judgment concern and against Haiku's 200K context ceiling; (b) if the successor supports `effort`, §7.2's constraint relaxes and MECH gains a depth knob it does not have today. Sonnet 4.5's 2026-09-29 retirement is likewise a non-event here for the same reason. **Recommendation: monitor, do not migrate — there is nothing to migrate.**

### 7.4 The DR-015 reviewer-diversity question

`reviewer.md:9` and `registry.yaml:83` **already** state that *"a different model FAMILY (non-Claude) is even better, since a different size within one family still shares its training blind spots"* — so this audit is not introducing the doubt, only observing that the 4.x→5 transition may have narrowed the intra-family gap further (opus-5 and sonnet-5 are generation siblings where opus-4.x and sonnet-4.x were further apart). **No repo evidence measures this either way `[expected, not demonstrated]`.** Acting on it would mean routing the judge to a non-Claude model, which breaks strict runtime locality (`agent-portability.md:11`) and needs its own proposal — and the only available non-Claude runtime is dormant with a negative evidence balance (R-30/R-34).

**Verdict: dies as an action item for this audit; survives as owner question §12.7.** What does *not* change under any reading: the reviewer stays a **different instance from the generator** — the structural half of DR-015 is model-independent.

### 7.5 Fable opt-in policy

**Keep the current policy verbatim.** `conventions.md:51`: Fable is *"only used when the owner explicitly asks for it, or when the agent sees a genuine benefit and asks the owner for confirmation BEFORE launching it"*; `AGENTS.md` rule 11 and `agent-portability.md:47` make it "owner request only". **Never automatic.**

**There is exactly one precedent, and it is a good one:** DR-114 / proposal 26, `registry.yaml:664` — *"Fable hardening sprint WS3 (2026-07-04, proposal 26 — the owner's explicit one-shot Fable opt-in)"* — four Fable subagents did prompt-surgery across the whole 14-agent + 26-skill surface, independently verified afterwards by a fresh-context pass.

**Where a new opt-in would be justified now** — by analogy to that precedent, `[expected, not demonstrated]`:
1. **R-02's prompt-surface recalibration for the Claude 5 generation** — the exact shape of DR-114's sprint, whose own trigger condition has recurred. Computed cost: a ~20-call sprint = 20 × ($1.44 − $0.78) = **+$13.20 over the same sprint on Opus 5** (~$28.80 vs ~$15.60 in call-units).
2. **Reconciling this audit's nine area reports into one coherent change set**, if the owner wants a single agent to hold all of it.
3. **Not** for any of the 14 agents' routine work. Nothing here surfaces a routine task needing it.

**Ceremony:** a `docs/proposals/` entry recording scope, expected cost and success criteria *before* launching — exactly what proposal 26 did.

---

## 8 · Claude Code tools vs the factory

All source URLs accessed 2026-09-02. Every `[UNVERIFIED]` tag is carried forward unchanged.

| Tool / feature | Source + date | Maturity | Factory status `path:line` | Proposal | Claude-only? + DR-113 translation | Red-team result |
|---|---|---|---|---|---|---|
| Dynamic Workflows | docs/en/workflows, 2026-09-02 | GA | **USES** — `implement/SKILL.md:68`; `.claude/engines/pandacorp-backlog.js` (whole file) | Already the backbone | Yes — `AGENTS.md:97`: **no equivalent**; never imitate a live run | Current design; gaps are in the rows below |
| `agent()` `isolation:'worktree'` — **backlog engine** | docs/en/sub-agents, 2026-09-02 | GA | **IMITATES BY HAND** — `pandacorp-backlog.js:151-154` (no `isolation`), `:131-138` (~700 words of manual `git worktree` prose) | **REJECTED — R-16, precondition refuted** | No (session-native); `EnterWorktree` → `git worktree` by hand | **DIES.** See §10.1 |
| `agent()` `isolation` — **build engine gate worktree** | same | GA | **HAND-ROLLED, deliberately** — `pandacorp-build.js:279,986-1053`; `:556` (BL-0067); `grep isolation` over 2,108 lines → a prose match at `:2064` only | **REJECTED — R-15, all four required properties contradicted** | No | **DIES.** See §10.1. The hand-roll is **vindicated**, not merely tolerated |
| `agent()` isolation for **WO-level parallelism** | same | GA | **REJECTED WITH REASONS** — `build-orchestration.md:126-138` (DR-060, "Single-writer commit — Option B, NOT worktrees") | **Do not reopen** | No | thesis dies — argued from Next.js/pnpm mechanics and merge correctness, none of which a better model changes |
| **`/goal`** | docs/en/goal, 2026-09-02 | GA | `implement/SKILL.md:70,77,91` hand-specifies the supervisor contract | **REJECTED as a heartbeat/termination substitute — R-17**; optional attended nudge only | Yes; none → stay attended | **DIES.** See §10.1 |
| `Monitor` | docs/en/tools-reference, 2026-09-02 | GA | **USES** — `implement/SKILL.md:70,89` | Keep — the event-driven watcher half | Yes; none → attended | — |
| `CronCreate` / **`ScheduleWakeup`** | docs/en/scheduled-tasks, 2026-09-02 | GA (session-scoped) | **USES** — `implement/SKILL.md:70,77,91`; near-misses at `LESSON-0096:19-36` and `_inbox.md:462-474` | **R-37** (promote the lesson) — **blocked on R-71** | Yes; none → attended | Process debt, plus a newly-found contradiction (R-71) |
| **`/loop`** | docs/en/scheduled-tasks, 2026-09-02 | GA, **7-day expiry** | **USES** — `review-launch/SKILL.md:3,34`; `memory/SKILL.md:3,14` | **R-72** — the durable mechanism is `plugin/docs/routines.md`'s Desktop tasks | Yes; none → attended | **New finding** — a 12th promise-without-mechanism instance |
| Desktop scheduled tasks | docs/en/scheduled-tasks, 2026-09-02 | GA | **USES (off-repo)** — `plugin/docs/routines.md:3-4` | **R-18** — set the per-task permission posture to `dontAsk` | Yes | Replaces the malformed "does it inherit the account default?" question |
| `claude -p` headless / `--permission-prompts none` | docs/en/headless, 2026-09-02 | GA (flag **`[UNVERIFIED]`**) | DOES NOT USE | **Do not scope** — the flag is not on the page; use `--permission-mode dontAsk` | Yes | **Refuted.** See §10.1 |
| Built-in `auto` permission mode | docs/en/permission-modes, 2026-09-02 | GA (default on Pro/Max/Team since v2.1.228) | **USES for `/implement`** (`registry.yaml:107`), **NOT for routines** | **Do not enable for unattended routines** | Yes | `auto` is a per-action classifier — it widens what is approved with nobody present |
| `fewer-permission-prompts` | docs/en/skills, 2026-09-02 | GA (bundled) | DOES NOT USE (0 references) | **R-22 — adopt on a cadence** | Yes | stands, and is now a **dependency** of R-18 |
| **Hooks — 33 events** | docs/en/hooks, 2026-09-02 | GA | **USES 4** — `hooks.json:3,21,57,81` | **R-20** (`PreCompact`), **R-21** (`WorktreeRemove`); `SessionEnd` for vault sync (today at the *next* SessionStart, `.claude/settings.json:26-31`) | Yes; Codex wires only `PreToolUse`+`Stop` via `pandacorp-hook-adapter.mjs` | `PermissionRequest` as a hard block **dies** — explicitly rejected at `registry.yaml:574` |
| Non-`command` hook types (`async`, `prompt`, `agent`, `http`, `mcp_tool`) | docs/en/hooks, 2026-09-02 | GA (agent-hooks experimental) | **USES NONE** — every hook is `"type": "command"` | **R-19** — async the housekeeping hooks; keep safety hooks synchronous | Yes | Zero behaviour risk; `async` and `asyncRewake` both confirmed |
| **Bash sandbox** (`/sandbox`, Seatbelt) | docs/en/sandboxing, 2026-09-02 | GA | DOES NOT USE — `.claude/settings.json:3-8` has 4 deny rules only | **R-26** — orthogonal OS-level layer | Yes (macOS/Linux/WSL2) | Untried, cheap-to-try. **Net-new** — sequence after Phase 0 |
| Agent frontmatter (`effort`, `cacheTtl`, `maxTurns`, `background`) | docs/en/sub-agents — **[PARTIALLY UNVERIFIED]** | GA | **PARTIAL** — 9/14 set `effort:`; none sets `cacheTtl` | **R-25** — open question; may be unreachable from frontmatter | Yes (no Codex TOML equivalent) | `[UNVERIFIED]` which knob governs workflow-spawned agents |
| Agent Teams | docs/en/agent-teams, 2026-09-02 | **Experimental**, off by default | DOES NOT USE | None — **already considered and declined** at `build-orchestration.md:148` | Yes | dies — no case to reopen |
| Cross-session `SendMessage` / `ListAgents` | docs/en/cross-session-messaging, 2026-09-02 | GA | DOES NOT USE, but its design point is internalized | None — `LESSON-0096`'s conclusion is exactly `SendMessage`'s model | Yes | Category 2, already learned |
| Cloud Routines / `/schedule` | docs/en/routines + docs/en/scheduled-tasks, 2026-09-02 | maturity label **`[UNVERIFIED]`** | DOES NOT USE — all jobs are local `/loop` | **R-24 — wait** | Yes | *"Runs autonomously / no permission prompts"* is a stronger caution than immaturity |
| **`/deep-research`** | docs/en/workflows, 2026-09-02 | GA | DOES NOT USE — `researcher.md` + `discover/sources.md` hand-roll it | **R-23 — spike** | Yes | Worth a spike; never adopted or rejected before |
| **`EnterWorktree`/`ExitWorktree`** | docs/en/worktrees, 2026-09-02 | GA | **USES** — `CLAUDE.md:33` | Already adopted for session self-isolation | Yes; `git worktree` by hand | — |
| **Artifacts** | docs/en/artifacts, 2026-09-02 | GA | **DOES NOT USE** (0 uses) | **R-62** — publish mockups instead of `python3 -m http.server` (`.claude/launch.json:4-11,16-23`) | Yes | Correctly **not** for Mission Control (783 source files vs a single-page/no-backend model) |
| **Claude Design canvas / `DesignSync`** | docs/en/artifacts, 2026-09-02 | **Research preview** | **USES, with real production hardening** — `design/SKILL.md:32` + `references/canvas-procedure.md`; DR-058/101/109 | None — mature in-house | Yes; HTML-mockup fallback (DR-058 Plan B) | **Keep the caution language** — it is about a beta third-party surface, not model reasoning |
| **Agent Skills open standard** / `.agents/skills/` | docs/en/skills, 2026-09-02 | GA | **USES** — every `SKILL.md` carries `name:` | Already deliberate | **No** — open standard; native | Keep even under "drop Codex" — portability by format, one free symlink |
| `skill-creator` (bundled) | docs/en/skills — **[PARTIALLY UNVERIFIED]** | GA | **USES — verified wired**: `plugin/skills/learn/SKILL.md:37` *"If it is a SKILL (create or improve) — DON'T reinvent: delegate to `skill-creator` (native)"*, procedure at `:39`, reinforced at `:50` | **R-61 CLOSED — no gap** | Yes | The "no invocation line traced" claim is **refuted** (§10.1) |
| `claude plugin eval` / `/skill-doctor` | agent-routing config only — **[UNVERIFIED against primary source]** | unknown | DOES NOT USE (`claude plugin validate` **is** used, `CLAUDE.md:19`) | **R-63 — blocked** | Yes | Do not scope work on an unverified capability |
| Plugin marketplaces / `claude plugin validate` | docs/en/plugins, 2026-09-02 | GA | **USES** — `CLAUDE.md:16,19-23` | Already disciplined | Partial; Codex gets a projected manifest | — |
| Auto memory | docs/en/memory, 2026-09-02 | GA | **IMITATES A SUPERSET, deliberately** — `factory/profile.md`'s DR-053 funnel (`registry.yaml:297`) mines transcripts via `jq` (0 model tokens) | Tune only the funnel *order*: read the distilled auto-memory before the raw transcripts | Partial — auto-memory is Claude-local; `factory/profile.md` must survive across runtimes (DR-033) | mostly stands as-is — a deliberate cross-runtime design |
| `.claude/rules/` path-scoped rules | docs/en/memory, 2026-09-02 | GA | DOES NOT USE (no such directory) | **R-28 — design review** | Yes | Touches DR-051's rule-injection mechanism — not a blind swap |
| `/import` | docs/en/memory, 2026-09-02 | GA | DOES NOT USE | Low relevance — the factory owns both files (**`CLAUDE.md:5`** imports via `@AGENTS.md`) | Yes | — |
| **OpenTelemetry / `/cost` / `/usage`** | docs/en/monitoring-usage, 2026-09-02 | GA | **DOES NOT USE** for factory sessions — `observability.md:12,54,61` covers product apps only | **R-27 + R-12** | Yes | Complements, does not replace, the domain event stream |
| MCP v2 / `managedMcpServers` / `ToolSearch` | docs/en/mcp, 2026-09-02 | GA | DOES NOT USE `managedMcpServers` | No action — solo operator (constitution §11) | Yes | — |
| `PushNotification` | docs/en/sub-agents, 2026-09-02 | GA | **USES** — `implement/SKILL.md:70,92`; `pandacorp-build.js:287` | None — a 3rd-party app (ntfy) was explicitly rejected (`plugin/docs/decision-log.md:2066`) | Yes; `notify`/hooks, else chat | **Do not re-litigate** |
| `ultracode`, `workflowSizeGuideline`, `isolation:"remote"`, `/subtask`, `/fast`, statusline, Agent SDK / Managed Agents | docs/en/workflows, /sub-agents, /commands, /agent-sdk/overview, 2026-09-02 | GA (Managed Agents **[PARTIALLY UNVERIFIED]**) | DOES NOT USE | None — no engine use case; `maxAgents` (DR-070) is a harder brake than `workflowSizeGuideline`; `ultracode` fires only from human-typed interactive input | Yes / partial | — |
| `.codex-plugin/plugin.json` | **[UNVERIFIED against Anthropic docs; not a Claude Code feature]** | n/a | Generated projection — `generate-plugin-manifests.mjs:9-16`: *"Codex hook registration is owned by the enforcement projection… because plugin.json rejects hooks"* | Tied to R-30 | N/A (Codex-side) | **Not a naive invention** — an earlier version overclaimed `hooks`, was caught as P1-1 in the repo's own red team (`docs/proposals/32-native-dual-runtime/README.md:507-528`) and corrected. Still `[UNVERIFIED against a primary OpenAI source]` |

---

## 9 · What NOT to change, and why

**28 items** against §6's **11** prune-and-simplify rows. This asymmetry is the audit's honest result.

1. **The generator ≠ verifier trust boundary (constitution §3/§22/§24, DR-015).** `factory/constitution.md:46,48`; `implement/SKILL.md:174` *"Don't trust the worker's honesty… Never relax verification because 'the agent said it passed'."* Protects the entire FRD-gate rationale. A more capable generator makes its self-report *more* persuasive, not less in need of an independent check.
2. **Protected state paths + the backup/block-dangerous hooks.** `AGENTS.md` PROTECTED STATE PATHS; `plugin/scripts/block-dangerous.sh:1-30` *"FAIL-CLOSED on our own plumbing… a gate that silently allows everything when jq is missing is worse than no gate."* Protects BL-0035, whose **root cause is still UNKNOWN**. No model-capability argument addresses an unknown root cause; the risk is an irreversible *tool call*, not a *misunderstanding*.
3. **Human gates for money, deletion, external comms and production.** `AGENTS.md` rule 3; constitution §6; `devops.md:16` (DR-004). `factory/standards/infra.md:68-70` records why they are `deny` rules and not instructions: *"context compaction can lose them"* and *"auto mode is not a safeguard."*
4. **`security-auditor`'s `disallowedTools: Write, Edit`.** `security-auditor.md:5,10`. A stronger model is not a reason to let an auditor edit what it audits (`AGENTS.md` rule 4).
5. **WO-level "Option B, NOT worktrees" (DR-060).** `build-orchestration.md:126-138`. Argued from Next.js/pnpm mechanics (per-tree `node_modules`, cold builds, broken HMR on symlinks) and merge research (*"a textual merge can pass while the code fails to compile"*). None of those facts is model-dependent.
6. **`MAX_AGENTS`/`capHit()` as the primary brake, checked at wave granularity.** `pandacorp-build.js:67,111`. Protects two real overruns: 68 agents / ~4.95M tokens with `maxAgents=40` doing nothing (2026-06-21), and ~6M tokens against a 2M ceiling (2026-06-17). Keep it primary even after R-14 measures the native `budget`.
7. **`MAX_REOPENS=3` as the SINGLE convergence budget.** `pandacorp-build.js:71`. A red team explicitly collapsed a two-counter design *"eliminating the nesting/non-termination risk"* (`registry.yaml` DR-073 nota). A better model exhausts the budget less often; it does not remove the need for one hard, auditable ceiling.
8. **The atomic lease + fenced two-phase safe-point protocol.** `build-orchestration.md:1033-1124`; BL-0066's two-commit `last_green_sha` ordering; BL-0068's deterministic `lstat` stop receipt. It exists because Dynamic Workflows has **no host filesystem/process channel** (`build-orchestration.md:713-714`) — a platform fact.
9. **The memory anchor gate and the eval-gate's conservatism.** `factory/standards/memory-harvesting.md:105` cites ExpEL (arXiv:2308.10144, reflection layers measurably *disadvantageous*), A-MEM (memory poisoning) and EDV (~10% erroneous memories degrade agents). A more capable model is *more* persuasive when it hallucinates a lesson — which strengthens the case for an external checkable anchor.
10. **Never-delete / deprecate-only for lessons, and INDEX delta-only edits.** `factory/memory/README.md:24-26,96-100`; DR-011/DR-007. Protects reconciliation (a `library-verdict` that failed once may later be fixed) and, per ACE, context collapse from full-context rewrites — a known LLM failure mode still plausible under time/token pressure.
11. **DR-103's memory-vs-backlog split.** `factory/decision-log.md:595-598` — the owner personally caught this (*"LESSON-0002 felt like a bug to fix, not a lesson learned"*), deep-research-confirmed against SRE/ITIL practice. A taxonomy problem, not a capability gap.
12. **The byte-identical DR-047 memory-retrieve block across 6 agents.** `prompting-conventions.md:33` (PROMPT-7): kept identical *"so a future change can sweep it mechanically — divergent near-copies are how sweeps decay."* Collapsing it into an include breaks the grep-verifiable property it exists for.
13. **The Codex-mirror deterministic generation + Stop drift gate.** All 14 TOMLs verified matching their `.md` sources; `plugin/hooks/hooks.json:57-79`; `plugin/docs/decision-log.md:934` (7 tested cases). Hand-editing the TOMLs would be strictly regressive. (R-46 narrows *when* the gate runs, never *whether*.)
14. **The `capture-lessons-reminder.sh` backstop.** `plugin/scripts/capture-lessons-reminder.sh:1-9,15-38`. Protects DR-047 rule 8, a conversation-level instruction with no state. Already throttled four ways. "Native auto-memory covers this" dies on scope.
15. **The supervisor's heartbeat and human-facing narration.** `build-orchestration.md:752-786` — *"Silence reads as 'stuck' to the owner — the periodic heartbeat is what tells them it's alive."* An owner-UX requirement, not model drift. §10.1 removes the proposed mechanism change entirely; the contract was never in question.
16. **The Claude Design canvas caution language.** `plugin/skills/design/references/canvas-procedure.md:12-19,140-147`. Protects against a **beta third-party product surface** (the agent cannot pilot the canvas via API; it silently changes other files) — API limits, not reasoning limits. This verbosity does not shrink as models improve.
17. **`spec`'s "delegate Steps 2–8 in full, never a subset."** `scaffold/SKILL.md:11`; `plugin/docs/decision-log.md:717` (*"was silently dropping both"*). Two lines of insurance against a documented regression.
18. **The DR-045 preflight *content*.** `plugin/docs/decision-log.md:2126` — it replaced a failure mode (*"instead of empty-queue/hallucinating"*) with a deterministic check. Keep the byte-identical design; R-43 fixes only the missing caller.
19. **Strict runtime locality and the R2 fenced-epoch lease.** `docs/proposals/32-native-dual-runtime/README.md:31,343-363,402`. Protects against a real TOCTOU that could double-acquire the build lock **even in a Claude-only world** — so it survives even under "drop Codex".
20. **`.agents/skills` symlink + AGENTS.md as canonical instructions.** `agent-portability.md:209-210`. Costs one symlink and one import; un-doing it would mean re-forking every `SKILL.md`. Keep under every Codex option.
21. **DEBUG-1..4 and CONV-13.** `factory/standards/debugging.md:70-72` (incidents dated **2026-07-13** and **2026-07-15**, inside the current operating window: a sandboxed `curl` misread as "service down"; a frozen app's auto-decline misread as an owner refusal); `conventions.md:57` (CONV-13, owner-stated 2026-06-20 after repeated wrong state claims). These are blind spots about *what to be suspicious of*, not reasoning errors that scale away with capability.
22. **CONV-11 (interaction style).** `conventions.md:20-37`, DR-110. As much a stated **owner preference** as a hallucination guard. "The model does this anyway" is not on its own a reason to remove a stated preference.
23. **Mission Control's gamification.** ~20,308 of 182,490 src lines. Explicit, repeatedly-corroborated owner taste (`design-taste-rpg.md`). The naive "MC over-invests in eye-candy" read is contradicted by the only memory evidence on the subject.
24. **MC's derived Reference catalog and its mutable-fixture test.** `manual.reviewer.integration.test.tsx:23-24,189-190` renames a skill mid-test and asserts the Manual follows. The only end-to-end proof DR-046 has — and the control against which R-47's drift was visible at all.
25. **Fable's exclusion from automatic selection.** `conventions.md:51`; `registry.yaml:646`. A cost/consent policy, not a capability judgment — it should not be revisited merely because Fable-class models got better.
26. **The `sync` skill.** ~1–2 dedicated cold-audit sessions across 273 MC decision-log entries. It closes the gap between "code edited outside the pipeline" and "docs" — a *workflow choice*, not a model gap.
27. **The `PushNotification`/ntfy decision, the hard-`PreToolUse`-block rejection, and `--dangerously-skip-permissions`.** `plugin/docs/decision-log.md:2066`; `registry.yaml:574`; `docs/proposals/07-unattended-build.md:15`. All three were explicitly red-teamed and rejected. **Do not re-litigate.**
28. **The hand-rolled worktree machinery is now *vindicated*, not merely tolerated.** `build-orchestration.md:126-138` (DR-060 rejection), `pandacorp-build.js:279,556,986-1053` (the SHA-pinned, reused, crash-residue-preserving gate worktree), and the backlog engine's ~700 words of prose at `pandacorp-backlog.js:131-138` are all **correct by necessity**: `docs/en/sub-agents` (2026-09-02) documents a primitive that is default-branch-based, per-invocation, non-caller-choosable in path, and auto-cleaned. It cannot express SHA-pinning, path stability, reuse, or crash-residue preservation. **This is the single strongest piece of evidence against the audit's second thesis.**

---

## 10 · Red-team results

### 10.1 What died

| Item | Why it died | Source |
|---|---|---|
| **R-16 — backlog engine → `isolation:'worktree'`** | `docs/en/sub-agents`: `isolation: worktree` gives *"an isolated copy of the repository branched by default from your **default branch** rather than the parent session's HEAD"*; the path is **not caller-choosable**; a **new worktree is created per invocation** (no reuse); *"The worktree is automatically cleaned up if the subagent makes no changes."* The engine requires a **stable caller-chosen path** (`${FACTORY_ROOT}/.claude/worktrees/bl-${item.id}`), **reuse-on-resume** (*"If Git already registers WT for BRANCH, REUSE it… Never recreate or delete it"*, `pandacorp-backlog.js:129-137`), and a **separate serialized Merge `agent()` call that must find the same worktree**. The gating condition the synthesis itself set is answered **NO** by the primary source, without a spike. **Also `[UNVERIFIED]`:** `isolation` is not documented as an option of the Workflow script's `agent()` function at all. | docs/en/sub-agents, 2026-09-02 |
| **R-15 — build engine gate worktree → native** | Same source. The gate needs create-once + **SHA-pinned** (`capturePin`) + reused across N sequential passes + **dirty residue preserved as crash evidence** (`pandacorp-build.js:556`, BL-0067). All four properties are contradicted. Close it; the spike is unnecessary spend. **This is a positive finding for the factory** — see §9 item 28. | docs/en/sub-agents, 2026-09-02 |
| **R-17 as a heartbeat or termination substitute** | `docs/en/goal`: (a) *"If a subagent or a background shell command is still running when a turn ends, Claude Code **skips the evaluation for that turn**"* — the build **is** a background Workflow for its entire duration, so the evaluator is dormant for essentially the whole run; (b) the evaluator *"does not call tools, so it can only judge what Claude has already surfaced in the conversation"* — it cannot read `status.yaml`, git health, or the transcript-file count; (c) check-ins back off 30 min → 1 h → 2 h; (d) *"Claude Code starts at most **three** idle check-ins per goal between your prompts."* Against `implement/SKILL.md:91`, which demands a **visible owner message every ~20–30 min even with no anomaly**, for a whole overnight run — and `:70`/`:77`, where the ~2-min `ScheduleWakeup` is **renewing the atomic lease** (`pandacorp-build-state.mjs renew --token --epoch`), a functional requirement, not narration. **The hand-rolled supervisor is not a re-implementation of `/goal`. It is a different machine.** | docs/en/goal, 2026-09-02 |
| **`--permission-prompts none` as R-18's mechanism** | The flag **does not appear on `docs/en/headless`**. That page states *"For `-p`, the built-in starting permission mode is **Manual on every plan**"*, and the documented locked-down mode is `--permission-mode dontAsk` (*"denies anything not in your `permissions.allow` rules or the read-only command set… useful for locked-down CI runs"*). Routines are **Desktop scheduled tasks** (`plugin/docs/routines.md:3-4`), whose permission handling is *"Configurable per task"* — so the original question was malformed, and the answer is a GA setting available today. | docs/en/headless, docs/en/scheduled-tasks, 2026-09-02 |
| **`gate-test-repair` and `foundation-gate` as R-11 re-tier candidates** | `pandacorp-build.js:1110-1113` — the adjudicator exists because *"one fallback for two causes meant a defective test could grind a correct build through rebuild loops that could never converge (LESSON-0002)"*, and its prompt says *"You are an INDEPENDENT reviewer… judge the claim on the evidence — **do not take the patcher's word**"*. That is adversarial adjudication under DR-015, and **BL-0051 (p1, open) is the still-unfixed deadlock it arbitrates** — re-tiering it down before that deadlock is fixed is exactly backwards. `foundation-gate` (`:1184`) is dispatched `agentType: 'pandacorp:reviewer'` — a gate, i.e. the verifier half of DR-015. | live engine read, 2026-09-02 |
| **R-61 — `learn` does not invoke `skill-creator`** | **Refuted.** `plugin/skills/learn/SKILL.md:37` reads *"If it is a SKILL (create or improve) — DON'T reinvent: delegate to `skill-creator` (native)"*, with the procedure at `:39` and reinforcement at `:50` and `:57`. **Verified wired.** Removed from Phase 1. | live read, 2026-09-02 |
| **"Cut Mission Control investment" / "cut gamification"** | The only memory evidence bearing on it (`design-taste-rpg.md`) says the opposite. Downgraded to "show the owner the ratio" (R-50). | — |
| **`PermissionRequest` as a hard block; Agent Teams; ntfy; `--dangerously-skip-permissions`; WO-level worktrees** | All four were explicitly red-teamed and rejected before this audit. `registry.yaml:574`; `build-orchestration.md:148`; `plugin/docs/decision-log.md:2066`; `docs/proposals/07-unattended-build.md:15`; `build-orchestration.md:126-138`. **Do not re-litigate.** | — |

### 10.2 One further refutation, found while writing

**R-49 (the MC deploy machinery has no backup) DIES — the gap was closed on 2026-07-05.** The synthesis and the red-team both counted it among the "genuinely untracked" promise-without-mechanism instances, citing `factory/decision-log.md:590` (*"Follow-up worth a `BL-*`: the deploy machinery has no backup and can be swept again"*). But a **more recent** entry in the same log, `factory/decision-log.md:544` (finding **BK1** of the 2026-07-05 contradiction sweep), records that claim as **already corrected**: *"`backup-pandacorp-state.sh` has covered `run/*.sh` + `run/lessons.md` since v9.72.0."* Verified live in the script itself: `plugin/scripts/backup-pandacorp-state.sh:74-80` backs up `run/lessons.md` and every `run/*.sh`, inside a loop over every `.pandacorp` directory found up to 3 levels deep, with a comment naming this exact incident (*"losing it took Mission Control's always-on deploy down (BL-0035 follow-up)"*).

**Consequence for §5.1's count:** the eleven live instances split **6 already tracked in open BLs · 3 genuinely untracked (R-43, R-47/R-48, R-12) · 1 self-declared in the registry (R-42) · 1 refuted-as-closed (R-49)** — plus **R-72**, newly found, as a 12th instance and a 4th untracked one. R-49 leaves Phase 0.

### 10.3 What was downgraded

| Item | From | To |
|---|---|---|
| **R-36** | Impact **H**, Top-10 **#1** — *"a standing MUST-check would have caught all six"* | Impact **M**, demoted below R-35/R-41. The existing loop **did catch six** (BL-0055, 0063, 0069, 0088, 0089, 0090 — one of them nine days ago). What failed is **closing**, which a new MUST-check does not address. Worth promoting for the genuinely untracked instances |
| **R-11** | Impact **M**, four candidate sites, `diagnose` at `:1405` | Impact **L**, two candidate sites (`diagnose` at **`:1417`**, `revert` at `:1169`), gated on R-12 |
| **R-17** | Impact **H**, *"the largest hand-rolled prose block"* | Impact **L** — `/goal` would delete perhaps two sentences of a ~40-line contract |
| **R-18** | *"a purpose-built flag now exists"* + *"re-test whether the account default applies"* | `dontAsk` + allowlist maintenance, **explicitly not `auto`**; R-22 becomes a **dependency**, not an alternative |
| **R-05** | *"the only re-tier with on-repo failure evidence for the exact task shape"* | *"…for the adjacent shape"* — `LESSON-0076` records a stale **inventory** fact, not bad judgement, and is `status: candidate`, `promotion: none`, `confidence: medium`, `times_applied: 0` |
| **R-34** | *"the one real write-capable Codex run correlates with harm"* | *"…coincides in time with an unexplained deletion; BL-0035 records root cause UNKNOWN and lists three unranked candidate causes"* |
| **R-30 / §12.1** | Recommendation **(D) narrow** | **(B) freeze or (D) narrow, owner's call** — the reviewer's formal R11 verdict was **MODIFY** (`claude-code-review-report.md:234`), not drop, and it supplied a reopen trigger (*"Codex ships wake-capable local scheduling"*, `:278`), which makes freeze cheap and honest. And (D) is safe only once R-73's prerequisite is met |
| **R-37** | *"the cheapest high-value fix in the audit"*, Phase 0 | Blocked on **R-71** — promoting it as written would codify a rule the factory's largest skill violates |
| **R-19** | *"~45 s worst case"* | *"~115 s worst case in the factory repo"*, plus the duplicate-invocation finding (R-69) |
| **R-24** | *"research preview"* stated as fact | maturity label **`[UNVERIFIED]`**; the stronger caution is *"runs autonomously / no permission prompts"* |
| **R-52 / R-53 / R-54 / R-56 / R-40 / R-02 / R-62** | see §6 | citations corrected, canaries rewritten or given a sample-size condition, and R-02's own edit made PROMPT-6-governed |

### 10.4 Three steelmen the owner should read before deciding

**(1) Codex — steelman KEEP, and steelman DROP.**
*Keep:* DR-015's own text says a different model **family** is even better, since a different size within one family shares its training blind spots. Codex is the **only** non-Claude family the factory has any wiring for. Killing R-10 partly because *"the only available non-Claude runtime is dormant"* is circular — it is dormant because it was never used, and proposed for narrowing because it is dormant. Note that **(D) saves less than it appears**: it saves R10/R11 certification, not the per-change §13.1 tax, which survives under (B) and (D) alike.
*Drop:* the 11-day sprint bought a capability used **zero times in production** — no decision-log, memory or backlog entry records a Codex run shipping an FRD, fixing a bug, or reviewing an unrelated feature. Re-deriving an unused capability later, with better tools and a clearer spec, is cheaper than the original sprint, not equal to it. And (C) is the only option that closes the **PORT-6 hook gap** — the gap that made BL-0035 possible: a write-capable external runtime with **zero hooks** (BL-0030, open, untouched since July). Under (B) or (D), a *reviewer* Codex still runs with zero hooks (R-73).
*Verdict:* **(B) or (D), not (D) by default — and (D) only once the read-only property is mechanised.**

**(2) Permission mode — steelman KEEP the hand-curated allowlist.**
The primary sources invert the "native features may have obsoleted it" framing. Routines are Desktop scheduled tasks whose permission handling is *per-task configurable*. `claude -p` starts in **Manual on every plan**, so the v2.1.228 `auto`-by-default change never applied to headless routes. And under `dontAsk`, *"denies anything not in your `permissions.allow` rules or the read-only command set"* means **the allowlist becomes the entire permission surface**, not a legacy workaround. `auto` is the wrong lever for an unattended job: it is a per-action classifier, so it *widens* what gets approved with nobody present, on a machine whose one recorded permanent data loss has root cause **UNKNOWN** and lists a "worktree-sweep/cleanup script" among its suspects. The mode-independent backstops — 4 `permissions.deny` rules and the `PreToolUse` `block-dangerous.sh` gate — are real but narrow (`rm -rf`, force-push, `gh repo delete`, protected paths); they do not cover the general class. **Keep and grow the allowlist; change only the failure mode from silent stall to loud deny.**

**(3) Supervisor vs `/goal` — steelman the hand-rolled supervisor.**

| Supervisor obligation (`implement/SKILL.md`) | `/goal` |
|---|---|
| Renew the atomic lease every ~2 min with `leaseToken`/`leaseEpoch` (`:70`) | no tool access at all |
| Touch `.pandacorp/run/build.lock`, write `supervisor_heartbeat`, append `SupervisorTick` (`:77,:89`) | none |
| Owner-facing message every 20–30 min with WOs done/total, FRD, spend, "all green" (`:91`) | internal check-in, backs off to 2 h, **capped at 3 idle deliveries** |
| Watch `git status --porcelain` for `UU`/conflict markers → reset to `last_green_sha` (`:89`) | cannot read files |
| External `maxAgents` brake by counting `agent-*.jsonl` transcripts | cannot read files |
| Relaunch the next pass; distinguish stopping a run from stopping the loop (DR-068) | clears itself on "met"/"impossible" |
| Judge terminal state from `status.yaml` on disk | *"can only judge what Claude has already surfaced in the conversation"* |

### 10.5 Corrections applied, and inputs rejected

**Numbers corrected.** The commit histogram was wrong by ~90 commits: **868 June · 296 July · 6 August · 2 September** (= 1,172), re-verified live in this session; no combination of `git log` flags reproduces the earlier 780/347/5/2. Codex commits: **30**, not 26 (the quoted path list itself returns 30). Hook events: **4 of 33**, not "4 of ~30". Telemetry: **≈6.64k lines, live-appending** (6,642 at the audit hour), not a fixed 6,640. Registry: **137 rows — 31 wired / 105 manual / 1 aspirational**, against the file's own prose claim of 138/31/106/1. Always-layer: **289 lines**, not 169. `diagnose` dispatch: **`:1417`**, not `:1405`. `.codex/agents/tier-mech.toml:3` reads `model = "gpt-5.4-mini"` (an earlier quote was garbled). `CLAUDE.md:5`, not `:7`, carries the `@AGENTS.md` import.

**Inference corrected.** The direction of the commit histogram is unambiguous (868 → 6 → 2, last commit 2026-09-01), but "maintenance mode since mid-July is the common cause" is too strong as an **explanation**: 24 of the 25 "open, dated 2026-07-xx, untouched" findings were **filed during the busy period and left open**, which is a prioritisation fact, not a lull artefact — and BL-0090 was filed **2026-09-01**, i.e. the loop was still running *during* the lull. The lull explains why nothing was **closed**; it does not explain why items were filed and not prioritised in June and July, when 868 commits were being made. **A pause is not neglect.**

**Five inventory errors rejected and corrected throughout.** (1) `plugin/templates/shared/.claude/engines/pandacorp-build.js` was reported missing — it exists, 2,108 lines / 235,414 bytes. (2) "2 hidden skills" while listing 5 — there are **5** (`bug`, `iterate`, `scaffold`, `new-version`, `work-orders`); a `grep -l` also matches `change/SKILL.md:42`, but only in prose describing the others. (3) "5 hook events incl. `UserPromptSubmit`" — there are **4**, with 2 `PreToolUse` matchers and no `UserPromptSubmit`. (4) "`.claude/settings.json`: 8 SessionStart, 5 PreToolUse, 1 Stop" — it has 4 `deny` rules and a **single** `SessionStart` block of 3 hooks. (5) "~117 rules / 14 `promotion: proposed`" — **137** and **13**.

**Two auditor claims rejected.** The characterization of the preflight drift gate as *"already proven / mechanically verified"* — the **design** judgement stands, the **enforcement** claim is false (R-43). And the stated reason for rejecting `AskUserQuestion` (*"adopting it would reduce portability"*) — contradicted by `agent-portability.md:65`, which already defines the fallback; the conclusion is downgraded to a single-skill trial, not adopted wholesale (R-29).

**Category and tagging discipline.** 12 of 64 catalogue rows carried two categories against the brief's *"classify each finding into exactly one category"*; every row in §6 now carries exactly one, with the secondary nuance moved into the recommendation prose. Capability claims were tagged in roughly 5 places out of dozens; §6 now tags R-03, R-04, R-05, R-11, R-29, R-51, R-55, R-56 and §7.4/§7.5's claims explicitly.

**Four adoptions add machinery rather than removing it.** R-20, R-21, R-26 and R-27 delete nothing — all four are net-new hooks or layers. Under `LESSON-0113`'s own logic, adding four new mechanisms on top of the unwired ones is the wrong order. **They are sequenced after Phase 0 closes the unwired ones, and this document says plainly that they are additions.**

---

## 11 · Top-10 and the phased plan

| # | id | Action | Impact / Effort | Rationale |
|---|---|---|---|---|
| 1 | **R-35** | Fix BL-0090, then BL-0088, then BL-0089 | H / S each | Three one-file fixes restore the memory loop's documented behaviour and unblock 10 stuck owner-stated lessons at zero added risk. |
| 2 | **R-41 + R-43 + R-40** | Wire `check-standards.sh`, wire-or-mark `check-preflight-drift.sh`, derive the registry counts | M–H / S | Three unwired gates the factory already wrote and paid for; wiring them is cheaper than writing them was. |
| 3 | **R-30 (+ R-73)** | Decide Codex: keep / freeze / narrow / drop — and make BL-0030 a prerequisite of narrowing | H / S to decide | It gates R-01, R-31 and R-33, taxes every unrelated change, and has run nothing real in 48 days. |
| 4 | **R-12 + R-13** | Add a per-run cost/token rollup to `.pandacorp/track.jsonl`; recalibrate `COST()` | H / M | R-03, R-04, R-11 and R-56 are unfalsifiable until something measures spend. **Phase 1's first item.** |
| 5 | **R-36 + R-72** | Promote `LESSON-0113` via `learn` + owner, scoped to the 4 genuinely untracked instances; file R-72 | M / S | The loop's detection half works; this closes the gap where it does not reach. |
| 6 | **R-01 (+ R-74)** | Re-map the Codex tier table off the retired `gpt-5.4-mini` — after #3 | H / S | A dispatch to a retired id hard-fails. One JSON edit + two prose edits + a regen — and it also closes a "confirmed" sweep finding from July. |
| 7 | **R-47 + R-48** | Fix the `blueprint` slug and add the skill-dir ↔ flow drift test | M / S | A live DR-046 violation plus the guard that stops it recurring, both one-file changes. |
| 8 | **R-02** | De-version `prompting-conventions.md` (with its own PROMPT-6 receipt); file the DR-114-style recalibration | H / M | The standard's own stated trigger condition has recurred a full generation later, inside a `MUST`-tier rule. |
| 9 | **R-18 + R-22 + R-19 + R-69 + R-20** | The corrected cheap batch: `dontAsk` posture + allowlist refresh, async the housekeeping hooks, de-duplicate the backup hook, add `PreCompact` | H (R-18) / S each | R-18 alone addresses a failure class recorded three times — now with the documented mechanism instead of an unverified flag. |
| 10 | **R-05 + R-06 + R-08** | Re-tier the backlog scan; name the 4th tier; add the runtime-override pointer | M / S each | The one re-tier with an adjacent on-repo incident, plus two documentation fixes that keep the tier policy honest. |

### Phase 0 — zero-risk fixes of already-open items (no canary, no owner decision)

R-35 (BL-0088/0089/0090) · R-41 (BL-0055 + wire the checker) · R-40 (derive the registry counts) · R-43 (wire or mark the dormant script) · R-47 (`blueprint` slug) · R-32 (`CLAUDE.md:15`) · R-44b (clarify the decision-log phrasing) · R-06 + R-07 + R-08 (three documentation edits, via `learn`) · R-53 (`absorb`'s CONV-12 pointers) · R-60 (correct 169 → 289 in owner memory) · R-69 (de-duplicate the backup hook) · R-72 (file the `/loop` expiry BL) · R-74 (fold into R-01's edit).

**All S effort. None removes a gate. None needs the owner beyond the `learn` edits.**
**Removed from Phase 0 versus the synthesis:** R-49 (refuted, §10.2) and R-37 (blocked on R-71).

### Phase 1 — canaries and measurements, **cost telemetry first**

**R-12 first — it is the prerequisite for most of Phase 2.** Then: R-70 (measure the Stop path) · R-14 (re-measure `budget.spent()`) · R-18 (set and verify the routine permission posture) · R-71 (resolve the `ScheduleWakeup` contradiction, unblocking R-37) · R-54 (the rewritten ANCHOR scan-only drift test) · R-05 (haiku vs deterministic tier diff) · R-63 (verify `claude plugin eval` exists at all) · R-17's falsification canary (predicted outcome: evaluator runs ≈ 0 times mid-Workflow — if it holds, close R-17 permanently).

**Dropped from Phase 1:** R-15 + R-16's shared spike (precondition refuted — the spend is unnecessary) and R-61 (verified wired).

### Phase 2 — adoptions conditional on Phase 1

R-22 → R-18 (the allowlist refresh must precede the `dontAsk` posture) · R-19 + R-20 + R-21 + R-26 (the hook/sandbox batch — **all net-new machinery, deliberately sequenced after Phase 0**) · R-27 (OTel cross-check, **after** R-12) · R-11 (re-tier `diagnose` + `revert` on one project, **after** R-12 makes the result measurable) · R-03 + R-04 (recalibrate DR-100 and DR-073 thresholds, **only** with fresh build data) · R-02's recalibration sprint · R-48 (drift test) · R-42 (PERF-3 lint) · R-01 (Codex re-map, **if** Phase 3 keeps Codex) · R-29 (`AskUserQuestion` trial in `decide` only) · R-09 (test-writer symmetry, once the owner answers) · R-23 (`/deep-research` spike) · R-62 (Artifacts for mockups) · R-28 (path-scoped rules design review, as its own proposal) · R-57 (worker self-research, as its own proposal).

### Phase 3 — owner decisions (nothing below can be taken by an agent)

§12's seven decisions.

---

## 12 · Decisions only the owner can take

### 12.1 Codex future (R-30 / R-31 / R-33 / R-34 / R-73 / R-01)

| Option | Saves | Loses | Reversibility |
|---|---|---|---|
| **A — continue to R10 installed + R11 `LIVE_OVERNIGHT`** | nothing | the §13.1 tax continues indefinitely; the reviewer's own question stays unanswered; R11 needs a 3-hour+ owner-supervised, real-spend, machine-awake run, repeated whenever an executor/overlay hash changes | high |
| **B — freeze at read/review-only, with the reviewer's own written reopen trigger** | the recurring live-canary cost; answers the open question explicitly and reversibly | the one certified `attended_foreground` capability — **used zero times in production**, so the loss is theoretical. Requires reopening proposal 32's approved decision #4 | high |
| **C — drop entirely** | the full §13.1 tax, 17 TOMLs, `generate-codex-agents.mjs` (323 lines), ~10 `*codex*` scripts, closes 9 BLs, **and closes the PORT-6 hook gap** | `LESSON-0067`'s cross-check benefit becomes structurally impossible; contradicts five owner-approved decisions; needs DR-113 superseded | **medium** — re-deriving an unused capability later with better tools is cheaper than the original 11-day sprint, not equal to it |
| **D — narrow to a second-opinion reviewer role** | most of R10/R11's cost — **but not the §13.1 per-change tax**, which survives | nothing recorded | high |

**Evidence balance:** the only recorded rationale was ever cross-check (`docs/proposals/25:5`; a repo-wide grep for vendor-lock-in / resilience / cost returned **zero** matches, so those rationales were never argued or sized). The only demonstrated benefit was a review, and it was self-referential (`LESSON-0067`, in the portability layer Codex was part of). The only recorded harm came from *write* access, unconfirmed (R-34). The capability has run **nothing real in 48 days**.

**Recommendation: (B) or (D) — the owner's call, and not (D) by default.** The independent reviewer already supplied the falsifiable reopen condition (*"reevaluation trigger: Codex ships wake-capable local scheduling"*), which makes freeze cheap and honest. **If (D) is chosen, BL-0030 is a hard prerequisite** — today the review-only property is prose against `enforcement-policy.json:11`'s `workspace-write`, which is the same configuration that preceded BL-0035. **Whatever is chosen, do not leave it undecided — the tax accrues either way.**

### 12.2 Fable opt-in policy (§7.5)

Options: **(i)** keep as-is, opt-in only; **(ii)** additionally pre-authorize one Fable sprint for R-02's prompt-surface recalibration, with a proposal recording scope/cost/success criteria as proposal 26 did; **(iii)** broaden automatic selection.
Evidence: (i) is the current policy with one good precedent (DR-114). (ii)'s marginal cost is **+$13.20 in call-units** over the same sprint on Opus 5 — a rounding error against the governance value, and the DR-114 precedent fits R-02's shape exactly. (iii) contradicts CONV-12/DR-111 and the cost/consent policy.
**Recommendation: (i) + (ii).**

### 12.3 Mission Control effort share (R-50)

Options: **(i)** accept the ratio; **(ii)** cap new MC investment and redirect toward the Manual/Reference mirror function; **(iii)** freeze feature work, maintenance only.
Evidence: MC is **900 of 1,172 commits (76.8%)** for a tool with no market hypothesis (`factory/portfolio.md:8`: `return_type: personal`) — but it is also the only UI the owner uses daily, and its gamification (~11% of its source) is documented owner taste. Cutting it is contradicted by the only memory evidence on the subject.
**Recommendation: (i), with one condition — fund R-47/R-48 first.** The mirror function is what justifies the ratio, and it has visibly drifted.

### 12.4 Memory funnel triage (R-35 / R-36 / R-38 / R-37 / R-71)

Options: **(i)** fix the three bugs, then clear all 13 proposals in one `learn` sitting; **(ii)** fix the bugs only, leave the queue for organic drain; **(iii)** leave all of it and accept the loop is aspirational.
Evidence: the bugs are S effort; BL-0090 adds no risk (owner-stated is already the top trust tier); most queued lessons already have their target and rationale written.
**Recommendation: (i).** Sequence: BL-0090 → BL-0088 → BL-0089 → LESSON-0113 (R-36) → **R-71** → LESSON-0096 (R-37) → the remaining queue.

### 12.5 Spend on live validation of DR-117 / DR-118 (R-44)

Options: **(i)** build BL-0063's mock-worker harness first (L effort, permanently removes "validated only by the next real build"); **(ii)** run one supervised real `powerful` build and record the evidence (M effort, one data point); **(iii)** continue as-is and let the next overnight run be the test.
Evidence: `gateConverge` is a ~140-line, 5-branch state machine with zero engine tests and no CI; the only post-ship refinements came from the Codex canary track, not a Claude build.
**Recommendation: (ii) then (i).** One supervised run is cheap and closes the immediate evidence gap; the harness is the durable fix but should not block it. **One instrumented build can carry R-12's telemetry, R-17's falsification canary, R-03's granularity measurement and R-71's heartbeat check simultaneously.**

### 12.6 Permission posture for routines (R-18 / R-22)

Options: **(i)** keep the hand-curated allowlist unchanged; **(ii)** set the Desktop tasks' per-task permission configuration to **`dontAsk`** and keep the allowlist current via `fewer-permission-prompts`; **(iii)** enable `auto` for routines; **(iv)** wait for `--permission-prompts none` to be confirmed.
Evidence: routines are Desktop scheduled tasks with *per-task configurable* permissions — a GA setting, not an investigation. `dontAsk` makes the allowlist the entire permission surface, converting a silent stall into a loud denial. `auto` is a per-action classifier that widens approval with nobody present, against a machine whose one recorded permanent data loss has root cause UNKNOWN. `--permission-prompts none` is `[UNVERIFIED]` — not on the headless page.
**Recommendation: (ii). Explicitly not (iii).** This is the cheapest fix to a 3×-recorded incident class (BL-0054, BL-0085, LESSON-0119).

### 12.7 Model-tier questions: copywriter, Haiku, and DR-015 diversity

**Copywriter (§7):** options are (i) keep `opus`; (ii) blind A/B then decide. Evidence: no incident either way; savings ~$1–2.30 per project; the reason to move is tier coherence, not cost. **DR-114 rule 5 makes frontmatter pins governance-gated, so this cannot be an agent's silent edit. Recommendation: (ii).**

**Haiku 4.5 (§7.3):** options are (i) monitor; (ii) pre-emptively pin a successor. Evidence: retirement is 2026-10-15 but only the **alias** is pinned, so there is nothing to migrate; pinning a dated id would re-introduce exactly the staleness R-01 demonstrates. **Recommendation: (i).**

**DR-015 intra-family diversity (§7.4):** options are (i) leave the rule as written; (ii) commission a proposal on routing the judge to a non-Claude family. Evidence: `reviewer.md:9` already states the stronger form; **no repo evidence measures the 4→5 intra-family gap either way**; acting would break strict runtime locality and depends on the Codex decision (§12.1). **Recommendation: (i), and revisit only if §12.1 keeps or narrows Codex to exactly this role.**

**Test-writer escalation asymmetry (R-09):** options are (i) escalate `test-writer` in step with the implementer; (ii) record the asymmetry as intentional in a one-line comment. Evidence: the asymmetry is double (model *and* effort); no DR or BL argues either way; cost is +$0.468 per escalated WO. **Recommendation: decide either way and write it down — the current silence is the actual defect.**

---

## 13 · Sources

Repo citations are inline throughout as `path:line`, all opened during the audit; the writer independently re-opened 18 of them and re-ran the commit histogram and `check-standards.sh` on 2026-09-02.

| # | URL | Accessed | Supports |
|---|---|---|---|
| S1 | https://www.anthropic.com/news/claude-opus-5 | 2026-09-02 | Opus 5 release date, availability, pricing, capabilities, benchmark claims |
| S2 | https://www.anthropic.com/news/claude-sonnet-5 | 2026-09-02 | Sonnet 5 release date, pricing, capabilities |
| S3 | https://www.anthropic.com/claude-fable-and-mythos-5-1 | 2026-09-02 | Fable 5.1 / Mythos 5.1 ids, release date, availability restrictions, pricing, benchmark table |
| S4 | https://platform.claude.com/docs/en/about-claude/model-deprecations | 2026-09-02 | Full deprecation/retirement table (§3 rows 5–9) |
| S5 | https://platform.claude.com/docs/en/about-claude/pricing | 2026-09-02 | Canonical per-model pricing incl. cache multipliers; Sonnet 5's cancelled price bump; the ~30% tokenizer note; Haiku/Sonnet/Opus selection guidance |
| S6 | https://platform.claude.com/docs/en/models/overview | 2026-09-02 | Context windows, max output, thinking/effort defaults, **Haiku 4.5 "effort: Not supported"** |
| S7 | https://code.claude.com/docs/en/model-config | 2026-09-02 | Claude Code aliases (`haiku`/`sonnet`/`opus`/`fable`), default model per account tier, `CLAUDE_CODE_SUBAGENT_MODEL` |
| S8 | https://developers.openai.com/codex/models → https://learn.chatgpt.com/docs/models | 2026-09-02 | Codex lineup; **`gpt-5.4`/`gpt-5.4-mini` retirement 2026-08-31** and the `terra`/`luna` replacement mapping |
| S9 | https://developers.openai.com/api/docs/pricing | 2026-09-02 | GPT-5.x pricing used for §3.1's Codex rows |
| S10 | https://code.claude.com/docs/en/sub-agents | 2026-09-02 | `isolation: worktree` semantics (default-branch base, non-caller-choosable path, per-invocation, auto-cleanup) — **the refutation of R-15/R-16**; agent frontmatter fields |
| S11 | https://code.claude.com/docs/en/goal | 2026-09-02 | `/goal` evaluator has no tool access, defers while background work runs, backs off to 2 h, caps at 3 idle check-ins — **the refutation of R-17** |
| S12 | https://code.claude.com/docs/en/headless | 2026-09-02 | `-p` starts in "Manual on every plan"; `--permission-mode dontAsk` semantics; **`--permission-prompts none` absent → `[UNVERIFIED]`** |
| S13 | https://code.claude.com/docs/en/scheduled-tasks | 2026-09-02 | Desktop tasks "Permission prompts: Configurable per task"; `/loop` inherits from session and **recurring tasks expire after 7 days**; Cloud Routines' 1-hour minimum and autonomous execution |
| S14 | https://code.claude.com/docs/en/hooks | 2026-09-02 | **33 documented events**; `PreCompact`, `PostCompact`, `WorktreeCreate/Remove`, `SessionEnd`, `TaskCompleted`; `"async": true` and `asyncRewake` |
| S15 | https://code.claude.com/docs/en/workflows | 2026-09-02 | Dynamic Workflows; `/deep-research`; `workflowSizeGuideline`; **workflow agents fall outside the main cache TTL bucket (5 min default), governed by `subagentPromptCacheTtl`** |
| S16 | https://code.claude.com/docs/en/permission-modes | 2026-09-02 | Mode list; `auto` default on Pro/Max/Team since v2.1.228 |
| S17 | https://code.claude.com/docs/en/sandboxing | 2026-09-02 | `/sandbox`, Seatbelt, `dangerouslyDisableSandbox` (R-26) |
| S18 | https://code.claude.com/docs/en/memory | 2026-09-02 | Auto memory, `.claude/rules/`, `/import` (R-28, §8) |
| S19 | https://code.claude.com/docs/en/artifacts | 2026-09-02 | Artifacts and the Claude Design canvas (R-62, §9 item 16) |
| S20 | https://code.claude.com/docs/en/skills · /plugins · /worktrees · /monitoring-usage · /mcp · /agent-teams · /cross-session-messaging · /code-review · /commands · /checkpointing · /remote-control · /desktop · /agent-sdk/overview | 2026-09-02 | The remaining §4 and §8 rows |
| S21 | https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md + https://registry.npmjs.org/@anthropic-ai/claude-code | 2026-09-02 | Version→date mapping for every "first seen" claim (v2.1.259 published 2026-09-02) |
| S22 | https://openai.com/index/previewing-gpt-5-6-sol/ | 2026-09-02 (attempted) | **Blocked — HTTP 403.** Not used; noted so the gap is explicit |
| S23 | Secondary aggregation (marktechpost, techtimes, explainx, vellum, artificialanalysis, latent.space, codex.danielvaughan, aiidelist) | 2026-09-02 | GPT-5.6 GA date, effort levels incl. `ultra`, SWE-bench Pro figures, the conflicting price range — **all `[UNVERIFIED]`; nothing in this document rests on them** |
| S24 | arXiv:2308.10144 (ExpEL), A-MEM, EDV — cited via `factory/standards/memory-harvesting.md:105` | (in-repo citation) | §9 item 9's rationale for the memory anchor gate |

---

## 14 · Implementation plan

**Nothing in §1–§13 has been executed.** This section is the routing layer: it takes every surviving row of
§6, every item of §11's phased plan and every decision of §12, and assigns each one a **mechanism that
already exists** — a `BL-*` item drained by `/pandacorp:implement-backlog`, a `/pandacorp:learn` run, a
`/pandacorp:memory` promotion, a `/pandacorp:change` card in a product project, an owner decision, or a new
`docs/proposals/` entry. **No new machinery is built to execute this audit.**

Repo state re-verified for this section on 2026-09-02: plugin **v9.97.0**; **91** `BL-*` files, highest id
**BL-0090**, `validate-backlog.sh` reports *"Next free id: BL-0091"* and **45 open + 2 doing**; **13**
lessons at `promotion: proposed`; all **14** `plugin/agents/*.md` pins are bare aliases.

**Not planned — dead in §10, do not re-open without new evidence:** **R-15** and **R-16** (native
`isolation: worktree` for the gate/backlog worktrees — refuted by `docs/en/sub-agents`), **R-49** (the MC
deploy backup gap — refuted as already closed, §10.2), **R-61** (`learn` → `skill-creator` — verified
already wired), `/goal` as a heartbeat or termination substitute, `--permission-prompts none` as a
mechanism, `gate-test-repair` / `foundation-gate` as re-tier candidates, "cut Mission Control / cut
gamification", and the four previously red-teamed rejections (`PermissionRequest` hard block, Agent Teams,
ntfy, `--dangerously-skip-permissions`). §9's **28 keep items** are likewise out of scope by construction.

### 14.1 Ground rules

1. **Execution goes through existing engines only.** `implement-backlog` for closeable defects, `learn` for
   durable know-how, `memory` for the promotion queue, `decide`/chat for owner gates, `docs/proposals/` for
   anything needing its own design pass. A row whose mechanism is none of these is not ready to execute.
2. **Route by plane (DR-103), and the audit's own "File BL" verdicts are not binding on the plane.** Two
   rows in §6 say *File BL* for changes that live in **Mission Control**, a product project: **R-47** (the
   `blueprint` slug) and **R-48** (the skill-dir ↔ flow drift test). Per `AGENTS.md` §"Changing the factory
   itself", *"A change to a product project (Mission Control, siblings) never uses any of these: it goes to
   THAT project's `.pandacorp/inbox/changes/` via the `change` skill."* They are re-routed accordingly.
   `BL-0062` (R-51) and `BL-0084` already exist as factory items and are referenced, not duplicated.
3. **Never duplicate an open item.** 18 existing `BL-*` items carry part of this work; each is referenced by
   id below. New ids start at **BL-0091**, but the ids in the drafts are *placeholders in filing order* —
   `learn` step 0 is explicit that the real id comes from `bash plugin/scripts/validate-backlog.sh`, never
   from memory (BL-0010/0011 collided exactly that way).
4. **Plugin ritual on every `plugin/` change** (CLAUDE.md §Plugin maintenance): bump
   `plugin/runtime/plugin-metadata.json` (the SOURCE) per semver → `node
   plugin/scripts/generate-plugin-manifests.mjs` → `node plugin/scripts/generate-codex-agents.mjs` if
   `plugin/agents/*.md` changed → entry in `plugin/docs/decision-log.md` → commit → `claude plugin update
   pandacorp@panda-corp`. **Blocker found while planning:** `implement-backlog/SKILL.md` step 5 still tells
   every executing agent to bump `plugin/.claude-plugin/plugin.json` — a *generated projection* whose
   hand-editing REDs the derived-drift Stop gate. That is drafted as **BL-0119** and must be fixed before
   any multi-item drain.
5. **Two writes, always** (AGENTS.md §Decision log): the canonical doc *and* the area's decision log —
   `plugin/docs/decision-log.md` for plugin changes, `factory/decision-log.md` for standards/registry/
   constitution, `mission-control/docs/decision-log.md` for the two MC cards.
6. **DR-046** — every change to the factory's operable surface must also surface in Mission Control's
   Manual. Reference catalogs derive automatically; hand-authored Guides/Concepts are updated in the *same*
   change. The `Manual` column below flags which rows carry that obligation.
7. **No big-bang.** Four ordered waves. Wave 0 closes mechanisms the factory already wrote before Wave 2
   adds any new ones — `LESSON-0113`'s own logic, and §10.5's explicit sequencing note about R-20/21/26/27.
8. **Evidence before assertion (CONV-13).** Every canary below names what is recorded and where. A row whose
   canary was not run does not advance to the next wave on the strength of an expectation.

**Owner gates (nothing below proceeds without an explicit owner "yes"):** the seven §12 decisions · every
HIGH-RISK `learn` promotion (a MUST standard, a decision rule, a skill/agent — DR-047) · any Fable opt-in
(§12.2; §7.5 keeps it *"only used when the owner explicitly asks"*) · any change to an agent's `model:`/
`effort:` frontmatter (DR-114 rule 5 makes those governance-gated) · the permission-perimeter changes
(BL-0103, BL-0106) · any real-spend supervised build (§12.5) · and the go-ahead to file the BL batch itself.

### 14.2 Wave table

Tier is the tier of the **executing subagent** (CONV-12/DR-111), computed from the subtask, never inherited.
**Fable never appears** — it is not automatically selectable, and its one candidate use (BL-0111) is an
owner opt-in under §12.2. Effort: S ≤ half a day · M ≈ a day · L = multi-day.

#### Wave 0 — no decision needed, zero risk

Closes already-open items, wires scripts the factory already paid for, and corrects stale facts. Nothing
here removes a gate or adds machinery.

| R-id(s) | What | Mechanism | Tier | Effort | Depends on | Owner gate | Verification | Manual |
|---|---|---|---|---|---|---|---|---|
| — | Fix the manifest-bump instruction before any drain | **NEW BL (BL-0119)** | STANDARD | S | — | no | one single-item drain ends with a green derived-drift Stop gate | n |
| R-35 | Eval-gate never activates owner-stated candidates | **existing BL-0090** | STANDARD | S | — | no | the 10 owner-stated lessons flip to `active`; `validate-memory.sh` green | y (derived) |
| R-35 | `learn` approves but never flips `status: candidate → active` | **existing BL-0088** | STANDARD | S | BL-0090 | no | `LESSON-0147`/`LESSON-0152` reach `active` | y (derived) |
| R-35 | Harvest never instructs committing its own output | **existing BL-0089** | MECH→STANDARD | S | — | no | post-harvest `git status` clean on a fixture | y (derived) |
| R-41 | Two standards missing their rule-registry rows | **existing BL-0055** | STANDARD | S | — | no | `check-standards.sh` GREEN | y (derived) |
| R-40, R-41, R-43 | Derive the registry counts; give `check-standards.sh` and `check-preflight-drift.sh` a real caller | **NEW BL (BL-0091)** | STANDARD | S | BL-0055 | no | GREEN on clean tree; RED on a wrong-count fixture and on a diverged A1 preflight span | y (hand) |
| R-69, R-19 | Backup hook runs twice at SessionStart; both housekeeping hooks block synchronously | **NEW BL (BL-0092)** | STANDARD | S | — | no | exactly one backup marker per session; time-to-first-prompt over 3 sessions before/after | y (hand) |
| R-72 | The two recurring jobs advertise `/loop`, which expires in 7 days | **NEW BL (BL-0093)** | MECH→STANDARD | S | — | no | the `/loop` job is gone on day 8 while the Desktop task survives | y (hand) |
| R-32 | `CLAUDE.md:15` contradicts `AGENTS.md:98` on Codex build capability | **NEW BL (BL-0094)** | STANDARD | S | — | no | `grep -rn "read/review-only"` finds no statement contradicting PORT-5 | y (hand) |
| R-52, R-53 | Four-planes table restated in 4 files; `absorb` restates CONV-12 inline | **NEW BL (BL-0095)** | STANDARD | S | — | no | grep: one canonical copy + pointer *with* a read instruction in each consumer | y (hand) |
| R-06, R-07 | Name the `sonnet`+`effort: high` hybrid in PORT-2; fix the "minimal/low" wording | **`/pandacorp:learn`** | STANDARD | S | — | no | PORT-2 names the hybrid; `agent-portability.md:44` matches `model-tiers.json` | y (hand) |
| R-08 | Add the DR-073 runtime-override pointer to the 3 worker agent files | **`/pandacorp:learn`** | STANDARD | S | — | no | grep: each of `backend-dev`/`frontend-dev`/`implementer` names the escalation | y (derived) |
| R-44b | "offline coverage" vs "an offline seam against the real engine" | **existing BL-0063** (fold) | MECH | S | — | no | the clarifying sentence is in `plugin/docs/decision-log.md:744`'s vicinity | n |
| R-47 | The `blueprint` slug orphans the Manual's architecture page | **`/pandacorp:change` in mission-control** | STANDARD | S | — | no | load `/configuration` → Architecture card: diagram renders, explainer is Spanish | y (hand) |
| R-34 | Record the Codex evidence balance honestly before further investment | **`factory/decision-log.md` entry** | JUDGE | S | — | no | the entry states coincidence-in-time, root cause UNKNOWN, 3 unranked candidates | n |
| R-60 | Correct the stale "169 lines" always-layer figure (real: 289) | **auto-memory freshness fix** (no repo change) | MECH | S | — | no | the owner-facing memory note reads 289 | n |
| R-58 | Haiku 4.5 retires "not sooner than 2026-10-15" | **watch item** — no action | — | — | — | no | on the retirement date, the `haiku` alias resolves with **zero** repo edits | n |
| R-59, R-64–R-68 | The alias layer, `spec`'s full-delegation insurance, protected paths, the hand-rolled engine, the capture backstop, DEBUG-1..4 | **keep — no action** | — | — | — | — | — | n |
| R-10, R-39, R-55 | DR-015 intra-family gap · retrieval usage · the GOLD-first threshold | **no action** (surfaced as questions only) | — | — | — | — | — | n |

#### Wave 1 — canaries and measurements, cost telemetry first

Nothing in Wave 2 that depends on a number may start before **BL-0096** produces one.

| R-id(s) | What | Mechanism | Tier | Effort | Depends on | Owner gate | Verification | Manual |
|---|---|---|---|---|---|---|---|---|
| R-12 | **Per-run cost/token rollup into `.pandacorp/track.jsonl`** — the prerequisite for most of Wave 2 | **NEW BL (BL-0096)** | STANDARD | M | — | no | one instrumented build lands a `usage_summary` line; `dashboard-events.ndjson` unchanged | y (hand) |
| R-70 | Measure the Stop path (up to 345 s synchronous, never measured) | **NEW BL (BL-0097)** | MECH→STANDARD | S | — | no | per-hook split for 5 Stops recorded in `plugin/docs/decision-log.md` | n |
| R-14 | Re-measure `budget.spent()`'s subagent accounting — **measure, don't touch** | **NEW BL (BL-0098)** | STANDARD | S | BL-0096 | no | targeted build with `maxAgents` unset, `maxSpend` at a known ceiling; result written into `build-orchestration.md` | n |
| R-71 | `LESSON-0096` vs `implement`'s mandated `ScheduleWakeup` heartbeat — resolve before promoting | **NEW BL (BL-0099)** | JUDGE | S | a supervised build | no | the ~2-min heartbeat re-fires outside `/loop` for a full run with no duplicate spawns | y (hand) |
| R-54 | Verify the undated ANCHOR cwd-drift workaround — **test first, keep meanwhile** | **NEW BL (BL-0100)** | STANDARD | S | — | no | scan-phase-only run from a sibling cwd, with and without ANCHOR; every path absolute under `FACTORY_ROOT` | n |
| R-05 | The backlog scan asks a MECH agent for judgment | **NEW BL (BL-0101)** | STANDARD | S | — | no | tier diff, haiku vs a deterministic table, over the current `BL-*` set | y (hand) |
| R-17 | `/goal` falsification canary — close it permanently if the prediction holds | **NEW BL (BL-0102)** | STANDARD | S | a supervised build | no | evaluator runs mid-Workflow ≈ 0; ≤1 check-in between minute 30 and the end | n |
| R-63 | Does `claude plugin eval` exist at all? | **verification task** — no BL until confirmed | MECH | S | — | no | a fetched primary doc page, or the `[UNVERIFIED]` tag stands and no work is scoped | n |
| R-24 | Cloud Routines | **wait** — no action | — | — | — | no | *"runs autonomously / no permission prompts"* is the caution, not the maturity label | n |

#### Wave 2 — adoptions conditional on Wave 1

| R-id(s) | What | Mechanism | Tier | Effort | Depends on | Owner gate | Verification | Manual |
|---|---|---|---|---|---|---|---|---|
| R-22, R-18 | Refresh the allowlist with `fewer-permission-prompts`, **then** set the routines to `dontAsk` — explicitly not `auto` | **NEW BL (BL-0103)** | JUDGE | S | §12.6 | **yes (§12.6)** | fire `pandacorp-memory-review`: a genuinely new tool call fails **loud** | y (hand) |
| R-20 | `PreCompact` lesson-capture hook — **add, don't relocate** | **NEW BL (BL-0104)** | STANDARD | S | Wave 0 | no | compaction after an owner-correction fires the reminder *before* it completes | y (hand) |
| R-21 | `WorktreeRemove` soft warning (a hard block dies) | **NEW BL (BL-0105)** | STANDARD | S | Wave 0 | no | removing a worktree with an unmerged branch warns visibly and still proceeds | y (hand) |
| R-26 | OS-enforced Bash sandbox as an **orthogonal** layer | **NEW BL (BL-0106)** | JUDGE | S–M | Wave 0 | **yes** (safety perimeter) | one full `/implement` on a disposable project under `/sandbox` with nothing legitimate blocked | y (hand) |
| R-27 | Cross-check the in-engine counter against OTel `cost.usage` | **NEW BL (BL-0107)** | STANDARD | M | BL-0096 | no | three-way comparison recorded; the event stream unchanged | n |
| R-11 | Re-tier **only** `diagnose` (`:1417`) and `revert` (`:1169`) on one project | **NEW BL (BL-0108)** | JUDGE | M | BL-0096, BL-0051 | no | convergence rate + reopen count vs baseline; any degradation ⇒ revert | n |
| R-13 | Recalibrate `COST()` (real ratio 2.5×, not 3×); re-anchor `LESSON-0176`'s `~10x` | **NEW BL (BL-0109)** | STANDARD | S | BL-0096 | no | measured ratio vs `COST()`; `validate-memory.sh` green | n |
| R-03, R-04 | Recalibrate DR-100 granularity and DR-073/DR-107 escalation — **with data, never speculatively** | **NEW BL (BL-0110)** → `learn` | JUDGE | M | BL-0096, §12.5 | no | one `powerful` build at ~8k LOC/70 min vs the DR-100 baseline; `reopen_count` distribution vs DR-107 | y (hand) |
| R-02 (a) | De-version `prompting-conventions.md` to the neutral MECH/STANDARD/JUDGE vocabulary | **`/pandacorp:learn`** (with its own PROMPT-6 receipt) | JUDGE | S | — | **yes** (MUST-tier standard) | the never-degrade list survives verbatim; a fresh-context receipt ships with the edit | y (hand) |
| R-02 (b) | Re-run a DR-114-style PROMPT-6 pass over 14 agents + 26 skills against Claude 5 | **NEW BL (BL-0111)** | JUDGE (Fable only on §12.2 opt-in) | M | §12.2, R-02(a) | **yes (§12.2)** | PROMPT-6 fresh-context verifier on `reviewer.md` + `designer.md`, diffed vs the 2026-07-04 baseline | y (hand) |
| R-42 | Wire `PERF-3`, the last aspirational SHOULD, as a lint rule | **NEW BL (BL-0112)** | STANDARD | S–M | BL-0091 | no | the rule fires on a seeded barrel import; zero aspirational rows remain | y (derived) |
| R-01, R-74, R-07 | Re-map the Codex tier table off the retired `gpt-5.4-mini`; close sweep finding N3 | **NEW BL (BL-0113)** | STANDARD | S | **§12.1** | **yes (§12.1)** | `grep -rn "gpt-5\.4"` returns nothing; one `tier-mech` dispatch resolves (today it should 400/404) | y (hand) |
| R-29 | `AskUserQuestion` trial in **`decide` only** | **NEW BL (BL-0114)** | STANDARD | S | — | no | run on a real pending decisions file; the owner judges whether capture improved | y (hand) |
| R-09 | test-writer escalation asymmetry — decide either way and write it down | **NEW BL (BL-0115)** | STANDARD | S | §12.7 | **yes (§12.7)** | if escalated: one `difficulty:high` WO re-run, gate outcome compared | n |
| R-23 | `/deep-research` spike against `discover`'s hand-rolled playbook | **NEW BL (BL-0116)** | STANDARD | M | — | no | one lens run side by side; output shape diffed against the card schema | n |
| R-62 | Publish design mockups as Artifacts instead of `python3 -m http.server` | **NEW BL (BL-0117)** | STANDARD | S | — | no | the owner confirms the review link beats the local server (or it closes as rejected) | y (hand) |
| R-25 | Which cache-TTL knob reaches workflow-spawned agents? `[UNVERIFIED]` | **NEW BL (BL-0118)** | STANDARD | S | read `LESSON-0176` first | no | a primary-source answer, then a `/usage` cache-hit comparison across one FRD — or a documented negative | n |
| R-45 | The reopened-FRD / derogated-blessed-test deadlock (**p1, the highest-severity open engine item**) | **existing BL-0051** | JUDGE | M | §12.5 | no | the deadlock repro no longer converges to a stall | n |
| R-46 | Narrow the derived-drift Stop gate's scope (never *whether* it runs) | **existing BL-0082** | STANDARD | S | BL-0097 | no | two parallel sessions, one editing `plugin/`: the innocent one's Stop is no longer red | n |
| R-51 | Deterministic decision-id emitter shared by `decide` and MC | **existing BL-0062** — keep as filed, this audit adds corroboration only | STANDARD | M | — | no | a golden-file test: one `decisions.md` fixture through both implementations, identical ids | y (hand) |
| R-48 | Guard the hand-authored explainer layer against skill renames | **`/pandacorp:change` in mission-control** | STANDARD | S | R-47 | no | rename a skill dir in a fixture; the test REDs | y (hand) |
| R-44 | DR-117/118 have never been live-validated | **existing BL-0063 + BL-0069** | STANDARD / L | L | §12.5 | **yes (§12.5)** | the mock-worker harness runs `gateConverge` offline; CI runs the 12 `test-*.mjs` suites | n |
| R-28 | `.claude/rules/` path-scoping — design review, **not a blind swap** | **`docs/proposals/34-*`** | JUDGE | M | — | **yes** (it restructures DR-051) | n/a — the proposal is the deliverable | n |
| R-57 | Build workers cannot self-research | **`docs/proposals/35-*`** | JUDGE | M | — | **yes** | n/a — uncontrolled fan-out cost is the thing to size | n |
| R-56 | The split gate — **keep as-is; measure, don't move** | no action unless the owner funds it | — | — | — | no | needs **N ≥ 6 re-gates**; run it once and it will be over-read | n |

#### Wave 3 — owner decisions (§12). Nothing here can be taken by an agent.

| § | Decision | Options | Recommended default | What gets filed once decided |
|---|---|---|---|---|
| 12.1 | **Codex future** (R-30/31/33/34/73/01) | A continue to R10+R11 · B freeze at read/review-only with the reviewer's own reopen trigger · C drop entirely · D narrow to a second-opinion reviewer | **(B) freeze or (D) narrow — the owner's call, and not (D) by default.** (D) only once **BL-0030** is wired: today the review-only property is prose against `enforcement-policy.json:11`'s `workspace-write` — the same configuration that preceded BL-0035 | Under B/D: **BL-0113** (tier re-map) unblocks · **R-31** scope note via `learn` · **R-33** batch triage of the Codex items (live check: **5** of the audit's 9 are still open — BL-0030/0031/0032/0044/0084; the other four have closed since) · under D: **BL-0030** first. Under C: BL-0113 closes as superseded and DR-113 needs superseding |
| 12.2 | **Fable opt-in** (§7.5) | i keep opt-in only · ii additionally pre-authorize one Fable sprint for R-02's recalibration · iii broaden automatic selection | **(i) + (ii).** (iii) contradicts CONV-12/DR-111 and the cost/consent policy | A `docs/proposals/` entry recording scope, expected cost (**+$13.20** in call-units over Opus 5) and success criteria **before** launching — exactly as proposal 26 did. Then **BL-0111** |
| 12.3 | **Mission Control effort share** (R-50) | i accept the ratio · ii cap new MC investment · iii freeze feature work | **(i), with one condition — fund R-47/R-48 first.** The mirror function is what justifies 900 of 1,172 commits, and it has visibly drifted | Nothing new — it releases the two MC `change` cards (R-47, R-48) |
| 12.4 | **Memory funnel triage** (R-35/36/38/37/71) | i fix the 3 bugs then clear all 13 proposals in one `learn` sitting · ii fix the bugs only · iii accept the loop is aspirational | **(i).** Sequence: **BL-0090 → BL-0088 → BL-0089 → LESSON-0113 (R-36) → BL-0099/R-71 → LESSON-0096 (R-37) → the remaining queue** | `learn` promotions for `LESSON-0113` (scoped to the 4 genuinely untracked instances: R-43, R-47/R-48, R-12, R-72) and then the remaining 11 of the 13-item queue, each with its `promotion: approved` back-link |
| 12.5 | **Fund live validation of DR-117/118** (R-44) | i build BL-0063's mock-worker harness first · ii one supervised real `powerful` build · iii let the next overnight run be the test | **(ii) then (i).** One supervised run is cheap and closes the immediate evidence gap; the harness is the durable fix but should not block it | **One instrumented build carries BL-0096's telemetry, BL-0102's `/goal` canary, BL-0110's granularity measurement and BL-0099's heartbeat check simultaneously.** Then BL-0063, then BL-0069 |
| 12.6 | **Permission posture for routines** (R-18/R-22) | i keep the hand-curated allowlist · ii `dontAsk` + `fewer-permission-prompts` upkeep · iii `auto` · iv wait for `--permission-prompts none` | **(ii). Explicitly not (iii)** — `auto` widens approval with nobody present, against a machine whose one permanent data loss has root cause UNKNOWN. (iv) rests on a flag that is not on the headless page | **BL-0103**, executed in its two mandatory steps (allowlist refresh first) |
| 12.7 | **Model-tier questions** (copywriter · Haiku · DR-015 diversity · R-09) | copywriter: keep opus / blind A/B · Haiku: monitor / pre-pin a successor · DR-015: leave as written / commission a proposal · test-writer: escalate / record as intentional | **copywriter (ii) blind A/B** — DR-114 rule 5 makes the pin governance-gated, so it can never be an agent's silent edit · **Haiku (i) monitor** — only the alias is pinned, there is nothing to migrate · **DR-015 (i) leave as written**, revisit only if §12.1 narrows Codex to exactly this role · **test-writer: decide either way and write it down — the silence is the defect** | copywriter: a `learn` frontmatter change only if the A/B favours it (−$1 to −$2.30 per project — do it for tier coherence, not savings) · test-writer: **BL-0115** |

### 14.3 Execution sequence — the runbook

Steps marked **[unattended-safe]** can run in one background drain; **[owner present]** needs a human in the
loop for a gate, a judgement or a real-spend run.

1. **[owner present]** Read §14.2, approve the shape, and say go. Then file the batch: copy the cards from
   the T9 drafts into `factory/backlog/`, **taking each id from `bash plugin/scripts/validate-backlog.sh`
   at filing time** (it prints the next free id — currently `BL-0091`). File **BL-0119 first**. `learn`'s
   drain ritual applies: surface the 3 oldest open items to the owner while you are in there.
   *Filing order:* BL-0119 → the 5 Wave-0 cards → the 7 Wave-1 cards → the 16 Wave-2 cards (file them now;
   the gated ones simply do not get dispatched until their gate opens).
2. **[owner present]** `/pandacorp:implement-backlog BL-0119` — single-item mode, inline. **Do not start a
   multi-item drain before this closes:** every other item bumps the plugin version, and following the
   skill's current text hand-edits a generated manifest, which REDs the derived-drift Stop gate.
3. **[unattended-safe]** `/pandacorp:implement-backlog` restricted to **Wave 0**, in two dispatches so the
   plugin-version collapse risk (BL-0025, still open — the merge phase flags a collapsed bump loudly rather
   than fixing it) stays small:
   `Workflow({ scriptPath: '.../pandacorp-backlog.js', args: { items: ["BL-0055","BL-0090","BL-0088","BL-0089"] } })`
   then, after BL-0055 has merged:
   `args: { items: ["BL-0091","BL-0092","BL-0093","BL-0094","BL-0095"] }`.
   **Parallel-safe groups:** the second dispatch is safe as written — BL-0091 (`check-standards.sh`,
   `rule-registry.md`), BL-0092 (`hooks.json` SessionStart + `.claude/settings.json`), BL-0093
   (`memory`/`review-launch` SKILL.md), BL-0094 (`CLAUDE.md`) and BL-0095 (`learn`/`memory`/`absorb`
   SKILL.md) touch disjoint files apart from the version/decision-log hotspots the merge phase already
   knows how to resolve. **BL-0093 and BL-0095 both edit `memory/SKILL.md`** — keep them in the same
   dispatch so the serialized merge sees them in order, and read the run's `[FLAG: ...]` suffixes.
4. **[owner present]** `/pandacorp:learn` for the Wave-0 documentation rows: **R-06 + R-07** (PORT-2 names
   the `sonnet`+`effort:high` hybrid; MECH effort wording) and **R-08** (the DR-073 override pointer in the
   three worker agents). Agent prose is DR-114-governed, so this is a gated edit, not a drive-by.
   `plugin/agents/*.md` changed ⇒ regenerate the Codex mirrors.
5. **[unattended-safe]** In `mission-control/`, `/pandacorp:change` for **R-47** (the `blueprint` slug) —
   filed to that project's queue, drained by its own build. Record it in
   `mission-control/docs/decision-log.md`, not the factory's.
6. **[owner present]** Write the **R-34** entry in `factory/decision-log.md` (the Codex evidence balance,
   stated honestly) — it is an input to decision §12.1, so it lands before that conversation, not after.
7. **[owner present]** Take the **seven §12 decisions** in one sitting, in this order: §12.4 (memory —
   unblocks the most work) → §12.6 (permissions) → §12.5 (build validation funding) → §12.1 (Codex —
   the widest blast radius) → §12.2 (Fable) → §12.7 (tiers) → §12.3 (MC share). Record each in
   `factory/decision-log.md` with its rationale. **Do not leave §12.1 undecided — the tax accrues either way.**
8. **[owner present]** `/pandacorp:memory review` to refresh the promotion queue, then `/pandacorp:learn`
   for the §12.4 sequence: `LESSON-0113` (scoped to the 4 genuinely untracked instances) → then, only after
   BL-0099 resolves the contradiction, `LESSON-0096` → then the remaining 11 of the 13. Each promotion
   back-links (`promotion: approved`) and — once BL-0088 has shipped — flips `status: active`.
9. **[unattended-safe]** `/pandacorp:implement-backlog` for **Wave 1**, **BL-0096 alone first**
   (`args: { items: ["BL-0096"] }`) — everything measurable downstream depends on it. Then
   `args: { items: ["BL-0097","BL-0098","BL-0100","BL-0101"] }`.
10. **[owner present]** One **supervised `powerful` build** (§12.5 option ii) on a real project, carrying
    **four canaries at once**: BL-0096's telemetry rollup, BL-0102's `/goal` falsification counts,
    BL-0110's granularity measurement, BL-0099's heartbeat check. **Record where:** the numbers in
    `plugin/docs/decision-log.md` (the area log) and `.pandacorp/track.jsonl` (the run's own artifact); a
    one-line durable takeaway per canary in `factory/memory/_inbox.md` **in the same turn** (DR-047 rule 8,
    tagged `(agent-inferred)` unless the owner stated it).
11. **[unattended-safe, gate-by-gate]** `/pandacorp:implement-backlog` for **Wave 2**, in dependency order
    and in small batches: BL-0109 + BL-0107 (after BL-0096) → BL-0112 (after BL-0091) → BL-0114, BL-0116,
    BL-0117, BL-0118 (independent) → BL-0104, BL-0105 (net-new hooks, only once Wave 0 closed the unwired
    ones) → BL-0051, BL-0082. **[owner present]** for BL-0103, BL-0106, BL-0108, BL-0110, BL-0111, BL-0113,
    BL-0115 — each waits on its §12 gate.
12. **[unattended-safe]** In `mission-control/`, `/pandacorp:change` for **R-48** (the skill-dir ↔ flow
    drift test), after R-47 has landed.
13. **[owner present]** Write proposals **34** (R-28, path-scoped rules) and **35** (R-57, worker
    self-research). Neither is a BL; both need a design pass with the owner in the room.
14. **After every wave that touched `plugin/`**: `node plugin/scripts/generate-plugin-manifests.mjs` (and
    `generate-codex-agents.mjs` if agents changed) → `plugin/docs/decision-log.md` → commit →
    `claude plugin validate plugin/` → **`claude plugin update pandacorp@panda-corp`** (changes apply on
    session restart). Then check Mission Control's Manual for the **DR-046** rows flagged `y (hand)` above —
    the derived Reference catalogs follow on their own; the hand-authored Guides/Concepts do not.

### 14.4 Model policy for execution

- **The Claude side needs no migration.** All 14 `plugin/agents/*.md` pins are **bare aliases** — verified
  live for this section (`grep -n "^model:" plugin/agents/*.md`): 5 × `opus`, 9 × `sonnet`, zero dated ids.
  `plugin/runtime/model-tiers.json:4,8,12` pins `["haiku"] / ["sonnet"] / ["opus"]`, which §3 records as
  *"**correct by design** — no dated Claude id anywhere"*, and §3 again: *"The Claude half of the same table
  absorbed the entire 4.x→5 transition with **zero file edits**, because it pins aliases."* Those aliases
  already resolve to Haiku 4.5 / Sonnet 5 / Opus 5. **Nothing in this plan re-pins them.**
- **Tier per subtask, never inherited** (CONV-12/DR-111). The `Tier` column above is the executing
  subagent's tier; `implement-backlog`'s Scan phase recomputes it per item from `severity` and the Fix
  plan's reach — which is exactly why **BL-0101** (the MECH-tier judgment call) is worth running *before*
  the large Wave-2 batch, since it decides every item's tier.
- **Fable: opt-in only, one planned use.** §7.5 keeps the policy verbatim — *"only used when the owner
  explicitly asks for it, or when the agent sees a genuine benefit and asks the owner for confirmation
  BEFORE launching it"*. The single candidate here is **BL-0111** (R-02's prompt recalibration, §12.2 option
  ii, **+$13.20** in call-units over Opus 5), and only with the proposal-26-style ceremony filed first. No
  other row in this plan may select Fable, automatically or otherwise.
- **Haiku 4.5 retirement watch.** Retirement is *"not sooner than 2026-10-15"* — the nearest of any active
  model, ~6 weeks out. **Recommendation: monitor, do not migrate — there is nothing to migrate** (R-58);
  pinning a dated successor would re-introduce precisely the staleness R-01 demonstrates. Two things to
  re-check when it lands: the successor against BL-0101's judgment concern, and whether it supports
  `effort:` — today Haiku cannot participate in the effort axis at all, which is why a MECH step needing
  depth must move to STANDARD rather than gain a knob.
- **Codex pins follow the §12.1 decision.** Under **(B) freeze** or **(D) narrow**, BL-0113 re-maps MECH
  `gpt-5.4-mini` → **`gpt-5.6-luna`** — the `[UNVERIFIED]`-flagged rows of §3 (GPT-5.6 context windows,
  effort levels, benchmark figures) stay unverified and **no part of this plan rests on them**; only the
  retirement fact and the published prices are load-bearing. STANDARD/JUDGE stay on `gpt-5.5` unless the
  owner acts on the recorded cost inversion (`gpt-5.5` $0.88 vs `sol` $0.624 vs `terra` $0.352). Under
  **(C) drop**, BL-0113 closes as superseded and DR-113 needs superseding. **Every dated Codex id in this
  plan is `[UNVERIFIED]` beyond its retirement/price line — verify against a primary OpenAI source before
  the edit ships.**

### 14.5 Risks and rollback

| Risk | Mitigation |
|---|---|
| **Collapsed plugin-version bumps** — two branches bumping from the same stale base; the merge phase flags it loudly but does not fix it (**BL-0025, open**) | Batches of ≤5 items; read every `[FLAG: ...]` suffix in the run report and reconcile before the next dispatch. **BL-0119 must ship first** so the bump lands on the source file, not a generated manifest |
| A drain agent writes into the wrong repo | Each item gets its own worktree (`.claude/worktrees/bl-<id>`, branch `bl/<id>`); the ANCHOR preamble plus the worktree-ownership check; **BL-0100** re-verifies that the ANCHOR still earns its place |
| A bad item corrupts the store | Merges are **strictly serialized**, one at a time, with `validate-backlog.sh` between every merge — a red reverts that merge and blocks only that item. Blocked items are never retried automatically |
| Rolling back **one item** | Revert its merge commit on `main`; the item's own frontmatter goes back to `status: doing` (never silently to `open`) with the blocker recorded |
| Rolling back **a whole wave** | Every wave is a contiguous run of `fix(backlog):`/`feat(backlog):` commits on `main` plus one version bump: revert the range, restore `plugin/runtime/plugin-metadata.json` to the pre-wave version, regenerate both manifests, then `claude plugin update`. Wave 0 and Wave 1 are pure additions/corrections and revert cleanly; Wave 2 rows that changed a **gate** (BL-0103, BL-0105, BL-0106, BL-0082) revert by restoring `hooks.json`/`settings.json` — verify the Stop gate is green afterwards |
| A canary is over-read on one data point | R-56 needs **N ≥ 6** re-gates; R-03/R-04 state their sample size explicitly; a threshold change with insufficient N is a RED, not a GREEN |
| **The audit's own numbers ageing** | R-33's "9 open Codex BLs" is already stale — a live check on 2026-09-02 finds **5** open (BL-0030/0031/0032/0044/0084). Re-derive counts at execution time; do not act on a figure recorded here without re-running its command (CONV-13) |
| Net-new machinery landing before the unwired mechanisms are closed | R-20/R-21/R-26/R-27 are sequenced strictly after Wave 0, per §10.5 and `LESSON-0113`'s own logic |
| Prompt-surface edits degrading behaviour | PROMPT-4/6 require the never-degrade list survive **verbatim**; the R-02 de-version edit ships with its own fresh-context receipt |

### 14.6 Estimated volume

| Quantity | Count | Notes |
|---|---:|---|
| **New `BL-*` items** | **29** | BL-0091..BL-0119; drafted ready-to-file. 6 in Wave 0 (incl. the discovered BL-0119), 7 in Wave 1, 16 in Wave 2 |
| **Existing `BL-*` items touched** | **18** | 0030, 0031, 0032, 0044, 0051, 0055, 0062, 0063, 0069, 0082, 0084, 0088, 0089, 0090 directly; 0025, 0083 as known blockers; 0065/0070/0071/0080 named by R-33 but already closed |
| **`/pandacorp:learn` runs** | **4** | R-06+R-07 · R-08 (Wave 0) · R-02(a) de-version · the §12.4 promotion sitting. Plus R-31's scope note if §12.1 keeps Codex |
| **Lessons promoted** | **13** | the full `promotion: proposed` queue (verified live: 13, not 14), led by `LESSON-0113` and — after BL-0099 — `LESSON-0096` |
| **Mission Control `change` cards** | **2** | R-47, R-48 — the product plane, not the factory backlog |
| **New proposals** | **2** | 34 (R-28 path-scoped rules) · 35 (R-57 worker self-research) |
| **Canaries / measurements** | **11** | BL-0096, 0097, 0098, 0099, 0100, 0101, 0102, 0106, 0107, 0108, 0110 — four of which ride one supervised build |
| **Owner decisions** | **7** | §12.1–§12.7 |
| **Rows requiring a DR-046 Manual touch** | **24** | flagged `y` in §14.2; the derived Reference catalogs follow automatically, the hand-authored Guides do not |

**Unattended-safe:** **Wave 0's drain** (steps 3, 5) and **Wave 1's first drain** (step 9) run start to
finish in background dispatches — every item there is a defect fix or a read-only measurement with a
script-checkable Done-when. **Wave 2 is mixed:** BL-0104, 0105, 0107, 0109, 0112, 0114, 0116, 0117, 0118,
0051 and 0082 are unattended-safe once their dependency has merged; BL-0103, 0106, 0108, 0110, 0111, 0113
and 0115 each wait on an owner gate. **Wave 3 is entirely owner-present.** The `learn` runs are never
unattended — every one of them is either a MUST-tier standard, an agent prompt (DR-114) or a HIGH-RISK
promotion (DR-047).

**Drafts:** the 29 ready-to-file cards live in
`/private/tmp/claude-501/-Users-Shared-Proyectos-panda-corp/9cd2edb3-c402-4270-bd3a-96eb7cec328e/scratchpad/T9-bl-drafts.md`
(nothing filed — the ids are placeholders in filing order).
