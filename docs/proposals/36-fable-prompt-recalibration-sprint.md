# Proposal 36 — Fable Prompt-Recalibration Sprint (scope/cost/success-criteria note)

**Status:** pre-launch contract · **Date:** 2026-09-03 · **Executor:** Claude Fable 5.1 (single sprint; owner opt-in, single-use) · **Precedent:** `docs/proposals/26-fable-hardening-sprint.md` WS3 / DR-114 (2026-07-04) — this note imitates its structure and its guardrails.

## 0. Authority for this note

Proposal 33 §12.2 gave the owner three options for the Fable opt-in policy: (i) keep opt-in-only, (ii) additionally pre-authorize **one** Fable sprint for R-02's prompt-surface recalibration with a scope/cost/success-criteria note filed first, (iii) broaden automatic selection. The owner chose **(i) + (ii)** on 2026-09-02 (`factory/decisions/registry.yaml` DR-114 nota, reaffirmed) and said **"proceed"** on 2026-09-03. Condition (a) of that pre-authorization — *"a `docs/proposals/` note recording scope, expected cost… and success criteria must exist first, exactly as proposal 26/DR-114 did"* — is this document. Condition (b) — an explicit owner go **at launch time** — is separate and still required before any Fable call is made; this note does not itself authorize launch.

This pre-authorization is **single-use, scoped to `BL-0111`**, and does not generalize. It does not revisit CONV-12/DR-111 (Fable stays excluded from automatic selection) or §9 item 25 of proposal 33 (the exclusion is a cost/consent policy, not a capability judgment).

## 1. Purpose

"Recalibrate the prompt surface to the Claude 5 generation" means: re-run the **DR-114 audit-then-recalibrate method** (proposal 26 WS3) against the models the factory now runs on (Sonnet 5 / Opus 5, per `factory/standards/prompting-conventions.md`'s own stated trigger — a model-generation change), and fix **form only** where PROMPT-1/2/3/7 are violated: mega-paragraphs mixing rule + rationale + exception + anecdote, emphasis inflation, over-triggering imperatives, dead cross-references. The 2026-07-04 sprint already found the prompts were "dense, evidence-anchored rule sets whose real defect is FORM" — not naive prescriptive filler — so this sprint should expect a **similarly small edit surface**, not a rewrite of all 40 files.

**It explicitly does NOT mean:**
- No behavior changes. No FRD-gate semantics, no state-machine token, no human-gate wording, no verification step is altered.
- No new rules, no new standards content, no new registry rows.
- No gate removals, no loosening of any `MUST`-tier rule.
- No touching any of the 28 "what NOT to change" items in `docs/proposals/33-model-era-audit.md` §9 (the generator≠verifier trust boundary, protected state paths, human gates, `security-auditor`'s `disallowedTools`, `MAX_AGENTS`/`MAX_REOPENS`, the atomic lease protocol, the memory anchor gate, DR-103's memory/backlog split, the byte-identical DR-047 block, the Codex-mirror drift gate, CONV-11, Fable's own exclusion policy, and the rest — full list in §9, reproduced for the sub-agents in §8 below).
- No frontmatter change (`name:`, `description:`, `tools:`, `disallowedTools:`, `model:`, `effort:`) — PROMPT-5 is `MUST` and this sprint is form-only.
- **Not** the de-versioning of `prompting-conventions.md`'s own "Opus 4.8/Sonnet-class" prose (lines 5–6, 48) or the verbatim copy in `registry.yaml:661`. That is R-02(a) in proposal 33 §11/§14.2 — a separate, smaller `/pandacorp:learn` edit with its own PROMPT-6 receipt, explicitly listed as **out of scope** in `factory/backlog/BL-0111-*.md`. It should land first (or in parallel, by a non-Fable session) so this sprint's baseline diff is against corrected prose, but this sprint does not do that edit.

## 2. Scope

**In scope — exactly these files, audited and recalibrated ONLY where the form fights Sonnet 5/Opus 5:**

| Set | Count | Path |
|---|---:|---|
| Agents | 14 | `plugin/agents/*.md` (`analytics.md` 21L, `researcher.md` 24L, `copywriter.md` 26L, `devops.md` 21L, `test-writer.md` 30L, `security-auditor.md` 30L, `backend-dev.md` 34L, `frontend-dev.md` 43L, `architect.md` 45L, `implementer.md` 45L, `product-manager.md` 52L, `librarian.md` 55L, `designer.md` 89L, `reviewer.md` 101L — 616 lines total) |
| Skills | 26 | `plugin/skills/*/SKILL.md` (1,634 lines total — BL-0111 says 26; the 2026-07-04 sprint covered 25, so this pass includes whichever skill was added since, expected `absorb`) |
| Standard | 1 (verify-only) | `factory/standards/prompting-conventions.md` — read as the governing rulebook for this sprint; NOT edited by it (its own de-version edit is R-02(a), out of scope, see §1) |

Checked and confirmed **not** in scope: `plugin/templates/shared/AGENTS.md.tpl` and the sibling `CLAUDE.md.tpl`/`README.md.tpl` were grepped for generation-specific wording ("Opus 4.8", "Sonnet-class", "weaker models", "older model") on 2026-09-03 — **zero matches**. Same grep across all 14 agent files and 26 skill files — **zero matches**. The generation-specific language lives ONLY in `prompting-conventions.md` and its registry mirror, both excluded per §1. This sprint's real object is therefore PROMPT-1/2/3/7 form debt (paragraph density, emphasis inflation), not literal "4.8"-style references — matching the 2026-07-04 finding exactly.

**Explicit non-scope (never touched by this sprint, whatever a sub-agent believes it found):**
- `plugin/hooks/*` (hooks.json, block-dangerous.sh, capture-lessons-reminder.sh, all check-*.sh gates)
- `.claude/engines/*` / `.claude/workflows/pandacorp-build.js` (the build engine — PROMPT-8 dispatch-prompt conventions apply to it but it is not a `SKILL.md`/agent file and R-02 does not name it)
- `factory/decisions/registry.yaml`, `factory/standards/rule-registry.md`, any other file under `factory/standards/` besides reading `prompting-conventions.md`
- `.codex/agents/*.toml` (generated — never hand-edited; regenerated mechanically in §5 step 4 if any agent's frontmatter changed, which it should not)
- `factory/memory/`, `factory/ideas/`, `factory/profile.md`, `factory/portfolio.md`, any `.pandacorp/` directory, `pandacorp-vault` — protected state paths, irrelevant to a prompt-surface edit and forbidden regardless
- Mission Control (`mission-control/`)

## 3. Why Fable and not Opus 5

`[expected, not demonstrated]` — this is the same bet the owner made in proposal 26, now re-validated once (DR-114 shipped a real, PROMPT-6-verified result from it) and re-authorized for exactly this recurrence:

- **DR-114 precedent is a positive data point, not a hope.** The 2026-07-04 sprint used 4 parallel Fable sub-agents for the surgery and shipped a verified result (0 normative-survival findings across all recalibrated files, per the plugin decision log v9.67.0/v9.70.0 entries). The task shape — read dense multi-rule prose, isolate what's genuinely load-bearing from what's incidental phrasing, restructure without dropping content — is exactly what a long-horizon agentic model with the largest context window (1M tokens, same as Opus 5/Sonnet 5) is positioned to do across 41 files in one continuous pass rather than many context-fragmented sub-agent calls.
- **The marginal cost is a rounding error against the governance value at stake** (§4): proposal 33 §7.5/§12.2 computed +$13.20 in call-units for a ~20-call reference sprint, against a `MUST`-tier standard (PROMPT-4/6) whose violation would be a governance regression across the entire daily-driven agent/skill surface.
- **This is not a capability judgment about Fable being "better."** Per CONV-12/DR-111 and proposal 33 §9 item 25, Fable's exclusion from automatic selection is a cost/consent policy and stays untouched by this one-shot use. The choice here is scoped, owner-approved, and single-use — it does not imply Fable should be reached for again without a fresh opt-in.

## 4. Cost bound

**Basis** (proposal 33 §3/§3.1, `[VERIFIED]` prices, S1/S5/S6): `claude-fable-5-1` = $10/MTok in, $50/MTok out, $0.25/MTok cache read (0.025×), 1M context, adaptive thinking always on, effort default `high`. `claude-opus-5` = $5/MTok in, $25/MTok out, $0.50/MTok cache read, 1M context — the comparator used throughout §7.5/§12.2.

**Reference call-unit** (§3.1's stated scenario, applied without modification): 200,000 input tokens (80% cache-read, 20% regular) + 20,000 output tokens ⇒ Fable = **$1.4400/call**, Opus 5 = **$0.7800/call**. Delta = **+$0.66/call (+85%)**.

**Sprint sizing:** 41 files in scope (14 agents + 26 skills + 1 standard read-only) plus the PROMPT-6 fresh-context verification pass per changed file. Using the same "~20-call reference sprint" proposal 33 §7.5 already computed for this exact task (audit pass + edit pass + verification pass amortized across parallel sub-agents, not one call per file):

| | Calls (est.) | Cost @ Fable | Cost @ Opus 5 (comparator) |
|---|---:|---:|---:|
| Reference sprint | ~20 | ~$28.80 | ~$15.60 |
| Delta | — | **+$13.20** | — |

**Hard ceiling: $50 in call-units for this sprint**, set at roughly 3.4× the ~$28.80 reference estimate to absorb the fact that the actual file count (41) exceeds the abstract "~20-call" reference and that verification is per-changed-file, not amortized. This is a bound on the Fable executor's own spend — it does not include the separate Opus red-team pass (§5), which runs at Opus 5 rates and is not part of the pre-authorized Fable allowance.

**Abort rule:** if the running total crosses **$50** before all 41 files are triaged, the sprint STOPS at the next safe point (a completed file, not a mid-edit state), commits what is green, and reports the remainder as a follow-up `BL-*` rather than continuing on owner silence. Cost is tracked by the launching session narrating running totals in chat (no live token-metering mechanism exists per proposal 33 R-12 — this is a manual, owner-visible tripwire, not an automated brake).

## 5. Method

1. **Isolate.** One Fable 5.1 agent (`isolation: "worktree"`) works the entire file set in a single git worktree/branch (`fable/prompt-recal-claude5` or similar) — never the shared checkout (DR-096).
2. **Audit first, edit only where warranted.** For each of the 41 files, the agent decides RESTRUCTURE / LIGHT-DEDUP / LEAVE against PROMPT-1/2/3/7 (exactly the three-way call the 2026-07-04 sprint made: 7 restructured, 8 light, 10 left, out of 25 skills; 4 of 14 agents touched). "Leave" is an acceptable, expected outcome for most files.
3. **Patch set with per-hunk rationale.** Every changed hunk is tagged inline (in the commit body or a sprint log) as one of: `prosthesis` (scaffolding written for an older, weaker generation and no longer load-bearing), `generation-wording` (a literal reference to a specific model name/version that should be neutralized), `dedup` (PROMPT-3 — a rule repeated in multiple phrasings, collapsed to one home). A hunk with none of these three justifications does not ship.
4. **Commit on the sprint branch**, one commit per file or per logical batch — never one giant commit (mirrors DR-086's per-unit commit discipline).
5. **Independent Opus 5 red-team pass** (fresh context, no memory of the Fable agent's reasoning): for every changed file, diff OLD vs NEW and (a) reject and revert any hunk that touches a §9 "what NOT to change" item, (b) reject and revert any hunk that changes a model-independent rule (a human gate, a fail-closed semantics, a state-machine token, a file path in the state layer, any frontmatter field), (c) otherwise run the PROMPT-6 fresh-context normative-survival check the standard itself requires (extract every normative element from OLD, assert survival in NEW). This is constitution rule 4 (agents never check off their own checks) applied twice: once as the standard's own named ritual, once again as the safety net for the Fable/Opus trust boundary specifically.
6. **Gates.** Only after the red-team pass is clean: `claude plugin validate plugin/`, `bash factory/standards/check-standards.sh`, `bash plugin/scripts/check-preflight-drift.sh`, `bash plugin/scripts/check-derived-drift.sh` — all green before merge.
7. **Merge.** Factory repo has no merge queue (CLAUDE.md — factory worktree branches merge directly to `main`, solo operator, constitution §11). Merge only after step 6 is green and the decision log (§9 below) is written.
8. **Version + decision log**, per `CLAUDE.md` §"Plugin maintenance": bump `plugin/runtime/plugin-metadata.json` (MINOR — form-only recalibration is a compatible change to existing skills/agents, same class as v9.67.0/v9.70.0), regenerate both manifests, regenerate Codex mirrors ONLY if any agent file changed (frontmatter should be untouched, so mirrors should regenerate to byte-identical output — confirm, don't assume), record in `plugin/docs/decision-log.md` + `factory/decision-log.md`.

## 6. Success criteria

All of the following must hold, each checked with a tool in the closing session (CONV-13 — no self-report):

1. **Line-count delta recorded per file.** `wc -l` on all 14 agents + 26 skills, before vs after, tabulated in the sprint's closing report — not just an aggregate.
2. **Zero rule-registry rows removed.** `factory/standards/rule-registry.md`'s PROMPT-1..8 rows (and every other row) present after the sprint exactly as before — a diff of the table, not a rerun of the recount script alone.
3. **`claude plugin validate plugin/` green.**
4. **`bash factory/standards/check-standards.sh` green** (0 aspirational MUSTs, rule count either unchanged or increased only by legitimately new rows — none expected from a form-only sprint).
5. **`bash plugin/scripts/check-preflight-drift.sh` green** — the DR-045 preflight blocks (A1/A2 spans) stay byte-identical across every carrier skill (change, bug, iterate, new-version, release, sync's justified variant).
6. **`bash plugin/scripts/check-derived-drift.sh` green** — Codex mirrors match their `.md` sources, both manifest versions in sync, `.agents/skills` symlink intact.
7. **Codex mirrors regenerated and diffed.** For any of the 14 agent files touched, `.codex/agents/*.toml` regenerated via `node plugin/scripts/generate-codex-agents.mjs` and confirmed identical to (or, if frontmatter legitimately changed against §1's own prohibition, that this is treated as a sprint FAILURE, not an accepted side effect).
8. **Every agent's `tools:`/`model:`/`effort:` frontmatter byte-identical, before vs after** — `git diff` on the frontmatter block of all 14 `plugin/agents/*.md`, asserted empty.
9. **PROMPT-6 receipts exist for every changed file** — the fresh-context normative-survival check's checklist recorded in the sprint log / decision log, one per file that was RESTRUCTURE or LIGHT-DEDUP (not required for LEAVE files).
10. **Sample verification per BL-0111's own acceptance test**: PROMPT-6's fresh-context verifier explicitly re-run on `reviewer.md` and `designer.md` (the two densest agents, and the two the 2026-07-04 sprint worked hardest), diffed against the 2026-07-04 baseline behavior described in the plugin decision log — RED if any never-degrade item is lost.
11. **Total spend ≤ the $50 ceiling (§4)**, reported as an explicit dollar figure (estimated from call/token counts if no live metering — proposal 33 R-12 already establishes the factory measures none) in the closing report, not asserted as "within budget" without the number.

If any of 1–10 fails, the sprint is not done — fix-forward within the same worktree/branch, do not merge partial state.

## 7. Rollback

Single sprint branch (`fable/prompt-recal-claude5`), never touching `main` until §6 is fully green. Rollback is `git branch -D` on the sprint branch pre-merge (no `main` history to unwind) or, if a defect surfaces post-merge, a plain `git revert` of the merge commit — the same one-commit-per-file discipline in §5 step 4 means a partial revert (reverting only the file(s) that regressed) is also possible without re-doing the whole sprint. No force-push, no history rewrite, no `main` reset under any circumstance (repo Git Safety Protocol).

## 8. The exact prompts

### 8.1 Fable executor prompt (self-contained, ≤60 lines)

```
You are recalibrating Pandacorp's factory prompt surface for the Claude 5
generation (Sonnet 5 / Opus 5), re-running the DR-114 method from
docs/proposals/26-fable-hardening-sprint.md WS3. Read that file, then
factory/standards/prompting-conventions.md (PROMPT-1..8) — that standard is
the rulebook you are enforcing, but you do NOT edit it (its own de-version
edit is a separate, out-of-scope change).

SCOPE — exactly: the 14 files in plugin/agents/*.md and the 26 files in
plugin/skills/*/SKILL.md. Nothing else. If you believe a fix belongs
elsewhere (a hook, the build engine, a standard), STOP and report it instead
of touching it.

TASK — for each file, decide RESTRUCTURE / LIGHT-DEDUP / LEAVE against
PROMPT-1 (goals over step enumeration), PROMPT-2 (emphasis is scarce),
PROMPT-3 (one rule one home, incident as a terse pointer), PROMPT-7
(skimmable shape, ~120 lines for agents). LEAVE is a fully acceptable
outcome for most files — do not manufacture edits to look thorough.

NEVER TOUCH, under any framing, in any file:
- Human gates (production deploy, money, data deletion, external comms,
  idea/design selection) — verbatim.
- Language rules (DR-009: committed English / gitignored Spanish / owner
  chat always Spanish) — verbatim.
- The two-layer documentation discipline (canonical doc + decision log).
- Fail-closed gate semantics (missing harness = RED, ambiguous = failure).
- State-machine contracts (status tokens like VERIFIED/IN_REVIEW/BLOCKED,
  who writes which frontmatter field, state-layer file paths).
- Any frontmatter field: name/description/tools/disallowedTools/model/effort.
- Anything on the "what NOT to change" list: the generator-verifier trust
  boundary, security-auditor's disallowedTools, MAX_AGENTS/MAX_REOPENS, the
  atomic-lease safe-point protocol, the memory anchor gate, DR-103's
  memory/backlog split, the byte-identical DR-047 memory-retrieve block
  across agents, the Codex-mirror drift gate, CONV-11 interaction style,
  DEBUG-1..4, Fable's own exclusion-from-automatic-selection policy. Read
  docs/proposals/33-model-era-audit.md §9 in full before starting — all 28
  items there bind you exactly as they bind a human editor.

METHOD — work in your assigned git worktree/branch. Per file you touch:
make the edit, tag every changed hunk inline as prosthesis /
generation-wording / dedup with one line of rationale, commit alone (one
file or tight batch per commit). Run PROMPT-6 yourself first (extract every
normative element from OLD, confirm each survives NEW) as your own
pre-check — a second, independent Opus pass will re-verify you.

OUTPUT — end with, per file: LEAVE / RESTRUCTURE / LIGHT-DEDUP and why; for
every changed file, the PROMPT-6 checklist. Report your own running cost.
Do not merge — hand off the branch for red-team review.
```

### 8.2 Opus red-team prompt (self-contained, ≤40 lines)

```
You are the independent verifier of a Fable-authored prompt-recalibration
sprint (proposal 36). Fresh context — you have not seen the Fable agent's
reasoning. Checkout its branch and diff every changed file in
plugin/agents/*.md and plugin/skills/*/SKILL.md against main.

For every changed file:
1. Confirm no hunk touches any item on docs/proposals/33-model-era-audit.md
   §9's "what NOT to change" list (28 items — read it in full first).
2. Confirm no frontmatter field changed (name/description/tools/
   disallowedTools/model/effort) — git diff the frontmatter block alone.
3. Run PROMPT-6 yourself: extract every normative element from the OLD
   version (rules, gates, thresholds, file paths, state tokens, DR/BL/
   LESSON references) and confirm each survives in NEW, or is listed as an
   explicit, reasoned removal.
4. Confirm every changed hunk carries a prosthesis/generation-wording/dedup
   tag with a one-line rationale that actually justifies it — reject vague
   or unjustified hunks.

If ANY check fails for a file: revert that file's commit(s) on the branch
(git revert, not force-push) and note why. Do not silently fix it yourself
— revert and let a human or a fresh Fable pass redo it.

When every remaining file is clean: run `claude plugin validate plugin/`,
`bash factory/standards/check-standards.sh`,
`bash plugin/scripts/check-preflight-drift.sh`,
`bash plugin/scripts/check-derived-drift.sh`. All must be green. If any
agent file changed, regenerate Codex mirrors
(`node plugin/scripts/generate-codex-agents.mjs`) and confirm the diff is
empty or explain why not.

Report: per-file verdict (accepted / reverted + reason), gate results,
whether the branch is ready to merge. Do not merge yourself — that is the
owner-facing closing step per §5 of proposal 36.
```

## 9. Decision line

The owner said **"proceed"** in chat on 2026-09-03, after the sprint's scope, cost bound and success criteria were presented per proposal 33 §12.2 option (ii) and DR-114's precedent. This note is the record of that contract: it fixes what the Fable sprint may touch (§2), what it costs at most (§4, hard ceiling $50), and what "done" means (§6, 11 checkable criteria) — before any Fable API call is made. The remaining condition, an explicit owner go **at launch time**, is separate from writing this note and must still be obtained by whoever runs the sprint. This authorization is single-use and scoped to `BL-0111`; it does not stand as precedent for any other Fable use without its own fresh opt-in per CONV-12/DR-111.

## 10. Sprint log (Fable executor, 2026-09-03 — branch `sprint/fable-prompts`, worktree `.claude/worktrees/fable-sprint`)

Appended by the executor; §1–9 untouched. Everything below was checked with a tool in the worktree (CONV-13). The independent Opus red-team pass (§5.5) has NOT run yet — this log is its input, hunk by hunk. Baseline = `main` @ `98e6a17f` (the branch was rebased once onto `main` @ `b2439490` — the commit that landed this very proposal — with no conflicts; the 41 in-scope files are identical at both commits).

### 10.1 Per-file table (all 41 in-scope files)

`wc -l` before/after are identical on every file (the edits shorten prose inside lines), so word counts are also given. Verdicts: **33 LEAVE · 7 LIGHT-DEDUP · 0 RESTRUCTURE** over the 40 edit-eligible files (the 41st in-scope file, `prompting-conventions.md`, is verify-only and has no verdict row) — 9 hunks (8 `dedup`, 1 `prosthesis`, 0 `generation-wording`). *(Corrected by the red-team pass from "34 LEAVE": the table's own 40 rows count 33 + 7.)*

| File | Lines before | Lines after | Words before | Words after | Hunks | Tags | Verdict |
|---|---:|---:|---:|---:|---:|---|---|
| `plugin/agents/analytics.md` | 21 | 21 | 614 | 614 | 0 | — | LEAVE |
| `plugin/agents/architect.md` | 45 | 45 | 1242 | 1242 | 0 | — | LEAVE |
| `plugin/agents/backend-dev.md` | 34 | 34 | 790 | 790 | 0 | — | LEAVE |
| `plugin/agents/copywriter.md` | 26 | 26 | 579 | 579 | 0 | — | LEAVE |
| `plugin/agents/designer.md` | 89 | 89 | 1898 | 1899 | 1 | dedup | LIGHT-DEDUP |
| `plugin/agents/devops.md` | 21 | 21 | 553 | 553 | 0 | — | LEAVE |
| `plugin/agents/frontend-dev.md` | 43 | 43 | 1037 | 1037 | 0 | — | LEAVE |
| `plugin/agents/implementer.md` | 45 | 45 | 1112 | 1112 | 0 | — | LEAVE |
| `plugin/agents/librarian.md` | 55 | 55 | 1275 | 1275 | 0 | — | LEAVE |
| `plugin/agents/product-manager.md` | 52 | 52 | 1378 | 1378 | 0 | — | LEAVE |
| `plugin/agents/researcher.md` | 24 | 24 | 495 | 495 | 0 | — | LEAVE |
| `plugin/agents/reviewer.md` | 101 | 101 | 2840 | 2807 | 2 | dedup · prosthesis | LIGHT-DEDUP |
| `plugin/agents/security-auditor.md` | 30 | 30 | 461 | 461 | 0 | — | LEAVE |
| `plugin/agents/test-writer.md` | 30 | 30 | 527 | 527 | 0 | — | LEAVE |
| `plugin/skills/absorb/SKILL.md` | 108 | 108 | 1834 | 1844 | 2 | dedup | LIGHT-DEDUP |
| `plugin/skills/adopt/SKILL.md` | 89 | 89 | 3603 | 3603 | 0 | — | LEAVE |
| `plugin/skills/architecture/SKILL.md` | 68 | 68 | 4224 | 4224 | 0 | — | LEAVE |
| `plugin/skills/bug/SKILL.md` | 27 | 27 | 710 | 710 | 0 | — | LEAVE |
| `plugin/skills/change/SKILL.md` | 45 | 45 | 1557 | 1557 | 0 | — | LEAVE |
| `plugin/skills/decide/SKILL.md` | 47 | 47 | 1575 | 1575 | 0 | — | LEAVE |
| `plugin/skills/design/SKILL.md` | 72 | 72 | 3511 | 3502 | 1 | dedup | LIGHT-DEDUP |
| `plugin/skills/discover/SKILL.md` | 119 | 119 | 4748 | 4726 | 1 | dedup | LIGHT-DEDUP |
| `plugin/skills/explore/SKILL.md` | 48 | 48 | 1066 | 1066 | 0 | — | LEAVE |
| `plugin/skills/implement-backlog/SKILL.md` | 61 | 61 | 1937 | 1937 | 0 | — | LEAVE |
| `plugin/skills/implement/SKILL.md` | 173 | 173 | 7501 | 7447 | 1 | dedup | LIGHT-DEDUP |
| `plugin/skills/iterate/SKILL.md` | 31 | 31 | 1370 | 1370 | 0 | — | LEAVE |
| `plugin/skills/learn/SKILL.md` | 57 | 57 | 2093 | 2087 | 1 | dedup | LIGHT-DEDUP |
| `plugin/skills/memory/SKILL.md` | 59 | 59 | 1751 | 1751 | 0 | — | LEAVE |
| `plugin/skills/new-idea/SKILL.md` | 42 | 42 | 1127 | 1127 | 0 | — | LEAVE |
| `plugin/skills/new-version/SKILL.md` | 30 | 30 | 664 | 664 | 0 | — | LEAVE |
| `plugin/skills/onboarding/SKILL.md` | 124 | 124 | 1468 | 1468 | 0 | — | LEAVE |
| `plugin/skills/recommend/SKILL.md` | 28 | 28 | 459 | 459 | 0 | — | LEAVE |
| `plugin/skills/release/SKILL.md` | 42 | 42 | 1365 | 1365 | 0 | — | LEAVE |
| `plugin/skills/review-launch/SKILL.md` | 34 | 34 | 834 | 834 | 0 | — | LEAVE |
| `plugin/skills/scaffold/SKILL.md` | 52 | 52 | 960 | 960 | 0 | — | LEAVE |
| `plugin/skills/spec/SKILL.md` | 42 | 42 | 2114 | 2114 | 0 | — | LEAVE |
| `plugin/skills/sync-portfolio/SKILL.md` | 47 | 47 | 720 | 720 | 0 | — | LEAVE |
| `plugin/skills/sync/SKILL.md` | 54 | 54 | 1859 | 1859 | 0 | — | LEAVE |
| `plugin/skills/upgrade/SKILL.md` | 99 | 99 | 3224 | 3224 | 0 | — | LEAVE |
| `plugin/skills/work-orders/SKILL.md` | 36 | 36 | 1402 | 1402 | 0 | — | LEAVE |
| **Total** | **2250** | **2250** | **68477** | **68364** | **9** | 8 dedup · 1 prosthesis | 33 L · 7 LD |

`factory/standards/prompting-conventions.md` read as the rulebook, not edited (R-02(a), §1). Generation-wording grep (`opus 4|sonnet-class|weaker model|older model|claude 3|claude 4`, case-insensitive) over the 40 files in the worktree: **zero matches** — confirms §2's finding.

### 10.2 Per-hunk rationale (one line each; tag → what changed → where the rule now lives)

1. `designer.md` §10 — **dedup** (PROMPT-3 one-home): the inline *grep-first* memory retrieval contradicted the byte-identical INDEX-first DR-047 block at the foot of the same file; the heading now points at "retrieval SOP below" and the rule keeps its domain triggers, `LESSON-NNNN` citation, `.pandacorp/comms/progress.md` note and `librarian` hand-off. Same fix v9.70.0 applied to implementer/backend-dev/frontend-dev. The block itself is untouched (§9 item 12).
2. `reviewer.md` §6 STOP RULE — **dedup**: "Grinding a passing feature on nits is the #1 cause of a build that never finishes" already closes the ADVISORY paragraph of the same section ("Rejecting on nits … is the #1 cause of the build never finishing — DON'T"); the STOP RULE keeps "when only cosmetic gaps remain, you are DONE" and its whole structural-vs-cosmetic list.
3. `reviewer.md` §6 Fidelity judgment — **prosthesis** (PROMPT-3 origin-as-pointer): the 17-un-sharded-surfaces retelling reduced to "(the Mission Control un-sharded-surfaces incident)"; the rule ("never no-op the per-route check just because per-FRD mocks are absent") and the DR-091 fallback chain are intact.
4. `absorb/SKILL.md` `## Rules` — **dedup**: six bullets restated Preflight 2 / Step 0 / Step 1 / Steps 2–4 / Step 6 in full; each is now the invariant plus a pointer at its operative step. Kept **verbatim**: the human-gates sentence (PROMPT-4), the DR-009 language bullet, the plugin-lifecycle bullet, the `pandacorp-research` protected-path warning.
5. `absorb/SKILL.md` Rules, Portability bullet — **dedup** (second pass on 4): the mechanics (`git rev-parse`, venv provisioning) live in Preflight 2 / Step 0; the bullet keeps the two prohibitions (never hardcode the path; never touch the system Python / install globally).
6. `design/SKILL.md` Rules — **dedup**: the DR-054 bullet restated Step 0's ADOPT-VISUAL path; it now points there and at Step 4, keeping "the build must look like it" (the only clause not in Step 0) and the "only when there is no approved visual" condition. Stale deixis "path below" (the path is *above*) re-anchored to "(Step 4)".
7. `discover/SKILL.md` 1c — **dedup**: the app-enhancement parenthetical restated the App-enhancement lens-table row (the bar) plus its rationale; it now names the bar, both disqualifiers (minority gripe on a beloved app; trivially-copyable feature) and the drop-or-flag action. Kill criterion 3f #4 left as the operative kill statement.
8. `implement/SKILL.md` §Unattended, "1. Launch + set the ceiling" — **dedup** (PROMPT-2/3): the paragraph re-stated the ARG-ECHO gate text verbatim (its home: Launch checklist step 4, unchanged) and the maxSpend/maxFrds ceilings (homes: `$ARGUMENTS`, §How a run stops, unchanged); it now points at both. "For an overnight run, always pass `maxAgents`" stays bold in the paragraph; §9 item 6 (MAX_AGENTS primary brake) untouched.
9. `learn/SKILL.md` Rules — **dedup**: the skill-naming rule duplicated step 5's convention in a second phrasing; now a pointer that still names the path shape, the `/pandacorp:<slug>` invocation, the never-hardcode-the-prefix rule and the `review-launch` example.

### 10.3 PROMPT-6 receipts (executor self-check; the Opus pass re-does this independently)

Method per changed file: every normative element of the OLD hunk text — rules, gates, thresholds, file paths, state tokens, DR/BL/LESSON references — listed and located in the NEW file (same hunk or the named home).

- **designer.md**: DR-047 ✓ · triggers (UI library / animation-charting dep / interaction pattern) ✓ · `active` `library-verdict`/`gotcha`/`anti-pattern` ✓ · cite `LESSON-NNNN` ✓ · `.pandacorp/comms/progress.md` ✓ · `librarian` harvest ✓ · "Grep the store by domain/tags" → superseded on purpose by the canonical block's INDEX-first-then-Grep SOP (intentional removal — the point of the hunk). Byte-identical DR-047 block unchanged.
- **reviewer.md**: DR-072 STOP RULE structure (3 in-loop cycles, reopen cap, cosmetic-class list, `.pandacorp/comms/visual-punch-list.md`, PASS, structural-class list, Layer A red, shell-presence gate) ✓ · "#1 cause of the build never finishing" ✓ (ADVISORY paragraph) · DR-091 fallback chain 1/2/3, `node e2e/screenshot-prototype.mjs` harness, `visual_source`, `ui: true` ✓ · intro DR-015 trust-boundary lines, VERIFIED/BLOCKED tokens, reopen cap ≥3, patch-first DR-073 — untouched.
- **absorb/SKILL.md**: source-is-data + never execute/install/run hooks + quote to owner ✓ · `git rev-parse --show-toplevel` derivation ✓ (Preflight 2) · `$RESEARCH_DIR/.tooling/` venv, no global installs ✓ · Steps 2→3–4 ordering ✓ · red team mandatory + visible ✓ · two-step owner gate ✓ · **human-gates sentence verbatim** ✓ · no new engine, routes to `learn`/`implement-backlog`/`memory` ✓ · CONV-12/DR-111 ✓ · DR-009 language verbatim ✓ · plugin-lifecycle bullet verbatim (`plugin-metadata.json`, `generate-plugin-manifests.mjs`, DR-113, `plugin/docs/decision-log.md`) ✓ · protected-path warning verbatim ✓.
- **design/SKILL.md**: DR-054 ✓ · fidelity over novelty ✓ · reproduce in tokens/`DESIGN.md` ✓ · no alternative directions ✓ · build must look like it ✓ · 3 directions only without an approved visual ✓ (+ Step 0 / Step 4 pointers). All other DR rules in the file untouched.
- **discover/SKILL.md**: strong+widespread pain that hurt the incumbent (rating dropped / many asking) ✓ · not a minority gripe on a beloved high-rated app ✓ · not trivially copyable in one update ✓ · dropped-or-flagged ✓ · "~10 users, not a market / isn't a business" rationale ✓ (lens-table row). Gate 3.0, 3a–3f, the discarded-card auto-record and every owner rule — untouched.
- **implement/SKILL.md**: ARG-ECHO gate text (`· maxAgents <N> ·`, `maxAgents OFF`, `args arrived as a <type>, NOT an object`, `TaskStop` + relaunch) ✓ verbatim in Launch checklist step 4 · overnight → always `maxAgents` ✓ (paragraph 1 + §How a run stops + Budget-ceiling bullet) · `maxSpend` secondary via `budget.spent()` ✓ (`$ARGUMENTS`, §How a run stops) · `maxFrds` test-only ✓ (same homes) · DR-032 single writer of `phase: implementation`, DR-063 lock, BL-0022 pins, `JSON.parse` fail-loud shim, immutable-commit safe point ✓ (same paragraph). Every DR-120 STOP statement, the concurrent-run guard, the DR-045 preflight, leases, the DR-067/069/070/072/073 rules — untouched.
- **learn/SKILL.md**: `plugin/skills/<kebab-slug>/SKILL.md` ✓ · slug in English ✓ · no `pandacorp:` prefix in directory or `name:` ✓ · invoked as `/pandacorp:<slug>` ✓ · `review-launch` example ✓ · "must match all the others" ✓.

**Criterion 10 (BL-0111 acceptance test — `reviewer.md` + `designer.md`)**: the v9.67.0 baseline shape (reviewer: sectioned lenses with the explicit BLOCKS vs ADVISORY split; designer: labeled sub-rules 3/4/7) is preserved verbatim except for the three hunks above; no never-degrade item (human gate, language, doc discipline, fail-closed semantics, state token) appears in any changed hunk. GREEN by the executor's read — to be re-run by the Opus pass.

### 10.4 Gates (exit codes observed in the worktree, after the rebase)

| Gate | Exit | Evidence |
|---|---:|---|
| `bash factory/standards/check-standards.sh` | 0 | `registry-count: 157 rules → 34 wired · 123 manual · 0 aspirational` · `OK: all standards conform (31 files)` |
| `bash plugin/scripts/check-preflight-drift.sh` | 0 | A1 byte-identical across change/bug/iterate/new-version/release; A2 across those + sync |
| `bash plugin/scripts/check-derived-drift.sh` | 0 | TOMLs regenerate identical; manifests both 9.102.5; `.agents/skills` link ok (linked-worktree note: the gitignored personal-ledger check is skipped, DR-033) |
| `claude plugin validate plugin/` | 0 | `✔ Validation passed` |
| `node plugin/scripts/test-pandacorp-backlog.mjs` | 0 | `RESULT: 32 passed, 0 failed` |
| Frontmatter invariance (14 agents vs `git show main:`) | 0 | md5 of each `---` block IDENTICAL on all 14 |
| `factory/standards/rule-registry.md` vs `main` | — | byte-identical (zero rows removed, criterion 2) |
| Codex mirrors | — | `designer.toml`/`reviewer.toml` regenerated; the diff carries no `model`/`effort`/`name`/`description`/`tools`/`sandbox` field (body-only) |

### 10.5 Close-out and cost

- Version: `plugin/runtime/plugin-metadata.json` 9.102.4 → **9.102.5 (PATCH)** on the coordinator's instruction (form-only, CLAUDE.md's PATCH definition); §5.8 suggested MINOR — recorded in `plugin/docs/decision-log.md` (v9.102.5 entry) so the red-team can overrule. `factory/decision-log.md` deliberately NOT touched (outside the executor's allowed close-out files; §5.8 names it — for the merging session).
- One commit on `sprint/fable-prompts` (§5.4 asked for per-file commits; this run's contract asked for one — the per-hunk table above is the revert unit for the red team: `git checkout main -- <file>` on any rejected file, then regenerate mirrors if it is an agent).
- Cost `[ESTIMATED, NOT MEASURED — CONV-13]`: no live token metering exists (proposal 33 R-12), so no figure below was read from a meter; all are the executor's own arithmetic over self-counted turns. Executor estimate from its own session: ~18 turns, ≈3.5M cache-read tokens ($0.25/MTok ≈ $0.90) + ≈0.4M fresh input ($10/MTok ≈ $4.00) + ≈55k output ($50/MTok ≈ $2.75) ⇒ **≈ $7.7, ≤ $12 with error margin — well under the $50 cap (§4)**. No abort triggered; all 41 files triaged.
- Deliberately left untouched (and why): DR-045 preflight blocks (byte-identical carrier spans); the DR-047 memory-retrieve block (6 agents, grep-verifiable); every DR-120 STOP statement in `implement` (one day old, fail-closed runtime boundary — PORT-5's home, not this sprint's); `adopt` Step 2/6b (DR-119 phase-derivation contract, state tokens); `architecture` step 9's long paragraph (a verbatim re-sectioning carries none of the three sanctioned tags, so it does not ship — candidate for a future pass); `backend-dev`/`frontend-dev` rule 7/8 bold hand-off contracts (state-machine text, PROMPT-4 verbatim-stable); `implement-backlog`'s BL-0100 haiku-drift note (owner-instructed retention, verified 2026-09-03); `prompting-conventions.md` and `registry.yaml:661` (R-02(a)).

### 10.6 Red-team verdicts (independent Opus 5 pass, 2026-09-03 — §5.5 / §8.2)

Fresh context, no access to the Fable agent's reasoning; every claim below was re-derived with a tool in the worktree (CONV-13). Baseline for the prompt surface is `main` — confirmed identical to the branch's merge-base `b2439490` for all 41 in-scope files, so `main` having advanced since the rebase (unrelated Mission Control FRD-24 work) does not contaminate the comparison. Method per hunk: (1) does the removed/tightened text map to a rule-registry row, a hook/script enforcement, a human gate, SSOT/decision-log discipline, a protected-path warning, CONV-13, the DR-045 preflight, the DR-047 block, DR-120 fail-closed text, or any of proposal 33 §9's 28 items? (2) is the rationale's "already lives at X" claim TRUE at the cited path? (3) behaviour or form? (4) real intra-file duplicate, or deliberate PROMPT-7 cross-file repetition?

| # | File | Tag | Claim checked | Verified? | Verdict | Reason |
|---:|---|---|---|---|---|---|
| 1 | `plugin/agents/designer.md` §10 | dedup | The canonical INDEX-first DR-047 block lives at the foot of the same file; implementer/backend-dev/frontend-dev already use the "(DR-047 — retrieval SOP below)" pointer form (v9.70.0) | **YES** — the `## Factory memory` block md5s **identical across all 6 agents** and identical to `main`; the three siblings carry the pointer phrasing verbatim | **ACCEPT** | §9 item 12 untouched (the byte-identical block is not the edited section). Removes a real contradiction — grep-first vs the block's INDEX-first SOP — and converges designer on the family form. Anti-drift, not drift. |
| 2 | `plugin/agents/reviewer.md` §6 STOP RULE | dedup | "#1 cause of the build never finishing" already closes the ADVISORY paragraph of the same section | **YES** — present and **bolded** in the same section (`…is the #1 cause of the build never finishing — DON'T.`) | **ACCEPT** | Rationale, not rule. The `MUST conclude "good enough"`, the cosmetic/structural class lists, the punch-list path and PASS all survive verbatim. Intra-file duplicate → PROMPT-3. |
| 3 | `plugin/agents/reviewer.md` §6 Fidelity | prosthesis | The 17-un-sharded-surfaces story has a home outside the prompt | **YES** — full narrative in `plugin/docs/decision-log.md:2636`, `factory/decision-log.md:1735` and `registry.yaml` DR-091; enforcement in `doc-lint.sh:94` | **ACCEPT** | The new form is literally PROMPT-3's own exemplar (`(the personal-page-v2 shell-404 incident)`). Rule + DR-091 fallback chain 1/2/3 + the canonical harness command intact. |
| 4 | `plugin/skills/absorb/SKILL.md` `## Rules` | dedup | Each bullet's mechanics live at Preflight 2 / Step 0 / Step 1 / Step 4 | **YES** — security & injection at Step 0 (l.39), CONV-12 at Step 1 (l.45), red team at Step 4 (l.64) | **ACCEPT** | Net **additive** on the security bullet (the full prohibition text is kept AND a pointer added). Human-gate, DR-009 language, plugin-lifecycle and `pandacorp-research` protected-path bullets **byte-identical to `main`** (diffed). |
| 5 | `plugin/skills/absorb/SKILL.md` Portability | dedup | `git rev-parse --show-toplevel` and the `.tooling/` venv live at Preflight 2 / Step 0 | **YES** — `ROOT="$(git rev-parse --show-toplevel)"` at l.21, venv at l.36 | **ACCEPT** | Both prohibitions retained (never hardcode; never touch system Python / install globally). The `pandacorp-research` name survives at l.21/22/108. |
| 6 | `plugin/skills/design/SKILL.md` Rules | dedup | Step 0 holds the ADOPT-VISUAL path; Step 4 is the 3-directions exploration | **YES** — Step 0 l.18 (full extraction contract incl. "do not invent an alternative"), Step 4 l.41 (`explore path only — SKIPPED when an approved visual was adopted`) | **ACCEPT** | DR-054 semantics unchanged. Also **fixes a real defect**: the stale deixis "path below" pointed at a path that is *above*. |
| 7 | `plugin/skills/discover/SKILL.md` 1c | dedup | The App-enhancement bar + its "~10 users, not a market" rationale live in the lens table | **YES** — same file, lens table row (unchanged in the diff) | **ACCEPT** | Both disqualifiers (minority gripe on a beloved app; trivially-copyable feature) and the drop-or-flag action survive. Gate 3.0 and kill criterion 3f untouched. |
| 8 | `plugin/skills/implement/SKILL.md` §Unattended ¶1 | dedup | The ARG-ECHO gate text is verbatim at Launch checklist step 4; `maxSpend`/`maxFrds` ranking at `$ARGUMENTS` + §How a run stops | **YES** — l.68 carries the gate **more completely than the deleted copy did** (it adds `(when you passed one)` and the `re-pass args; hardcode the scope` remedy); the ranking is at l.31/32/33, l.55 (`maxFrds` is never the overnight guardrail; `maxAgents` is`) and l.81/95 | **ACCEPT** *(highest-scrutiny hunk)* | The deleted text was a **degraded near-copy** of a fail-closed gate, not the gate itself — deleting it removes a drift hazard PROMPT-4 exists to prevent. §9 item 6 (`MAX_AGENTS` primary brake) untouched in prompt and engine. The paragraph already opened "the Launch checklist above already mechanizes this" — the edit made it internally consistent. PROMPT-8 reserves pointer references for exactly this surface (standing, session-read prompts). |
| 9 | `plugin/skills/learn/SKILL.md` Rules | dedup | Step 5 states the skill-naming convention in full | **YES** — step 5 bullet 3 carries kebab-case/English/no-prefix/`# /pandacorp:<slug>` H1/`review-launch` example | **ACCEPT** | Path shape, English slug, `/pandacorp:<slug>` invocation, never-hardcode-the-prefix and the example all survive in the bullet itself. |

**Result: 9 ACCEPT · 0 REJECT. Nothing reverted; the branch is unchanged except for this subsection and two accuracy corrections (§10.1 arithmetic, §10.5 cost label).**

**Independent normative-survival sweep (PROMPT-6, mechanical, all 7 changed files vs `main`):** zero `DR-`/`BL-`/`LESSON-`/`CONV-`/`PORT-`/`PROMPT-`/`DEBUG-`/`FRD-`/`WO-` references lost; zero backtick code-spans lost except two whose content survives in another span (`` `git rev-parse --show-toplevel` `` → inside `ROOT="$(…)"` at Preflight 2; `` `pandacorp-research` `` → `` `pandacorp-research/` `` at l.22/108). Capital-emphasis counts **unchanged**: `NEVER` 4→4 (reviewer), `MUST` 4→4 (implement), `ALWAYS` 0→0 (absorb) — the three lowercase deltas the sweep flagged are the prose words *"never finishes"*, *"must echo"* and *"always derive"* inside the deleted duplicate sentences. No PROMPT-4 never-degrade line was paraphrased, softened or simplified at its home.

**Success criteria (§6) re-verified with tools:**

| # | Criterion | Evidence | Result |
|---:|---|---|:--:|
| 1 | Per-file line-count delta recorded | Live `wc -l` = 616 agents (14) + 1,634 skills (26) = **2,250**, per-file delta vs `main` **zero on all 40**; words 68,364 — matches §10.1 exactly | PASS |
| 2 | Zero rule-registry rows removed | `git diff main..HEAD -- factory/standards/rule-registry.md` **empty** (byte-identical) | PASS |
| 3 | `claude plugin validate plugin/` | `✔ Validation passed` | PASS |
| 4 | `bash factory/standards/check-standards.sh` | exit 0 · `157 rules → 34 wired · 123 manual · 0 aspirational` · 31 files conform | PASS |
| 5 | `bash plugin/scripts/check-preflight-drift.sh` | exit 0 · A1 byte-identical across change/bug/iterate/new-version/release; A2 + sync | PASS |
| 6 | `bash plugin/scripts/check-derived-drift.sh` | exit 0 (linked-worktree note: gitignored ledger check skipped, DR-033) | PASS |
| 7 | Codex mirrors regenerated and diffed | `generate-codex-agents.mjs` re-run by the red team → `git status .codex/` **clean**; committed TOMLs already match | PASS |
| 8 | Frontmatter byte-identical (14 agents) | `git diff main..HEAD -- plugin/agents/*.md \| grep -E '^[-+](model\|tools\|effort\|name\|description\|disallowedTools):'` → **no matches**; both mirror diffs are body-only | PASS |
| 9 | PROMPT-6 receipts per changed file | §10.3 (executor) + the mechanical sweep above (independent) — 7/7 changed files | PASS |
| 10 | `reviewer.md` + `designer.md` re-verified | Both re-checked above (hunks 1–3); DR-015 trust-boundary lines, VERIFIED/BLOCKED tokens, reopen cap, DR-072 split and the DR-047 block all outside the diff | PASS |
| 11 | Spend ≤ $50, reported as a figure | ≈$7.7 (≤$12 with margin) — now explicitly labelled `[ESTIMATED, NOT MEASURED]` per CONV-13 | PASS |

Also confirmed: the sprint commit touches **no** protected state path (`.pandacorp/`, `factory/{ideas,memory,profile.md,portfolio.md}`) and no file outside §2's scope + the sanctioned close-out files. `node plugin/scripts/test-pandacorp-backlog.mjs` → **32 passed, 0 failed** (exit 0).

**Version class — red team confirms PATCH (9.102.4 → 9.102.5), no change.** `CLAUDE.md` §Plugin maintenance defines PATCH as "fix/adjustment/doc that doesn't change skill/agent behavior" and MINOR as "new compatible capability (new skill or agent, new option)". This sprint adds no capability and changes no behaviour — every hunk is a prose pointer replacing an in-file restatement. §5.8's MINOR suggestion was written before the edit surface was known and is superseded by the actual result. The v9.102.5 decision-log entry recorded the divergence and invited the overrule; the red team declines to overrule.

**Recommendation: MERGE.** Nothing to revert.
