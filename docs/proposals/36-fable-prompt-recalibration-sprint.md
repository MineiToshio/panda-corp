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
