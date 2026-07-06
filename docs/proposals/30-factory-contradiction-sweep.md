# RFC 30 — Factory contradiction sweep + the supersession-completeness gate

Status: proposed · Date: 2026-07-05 · Owner: factory maintainer
Home: this is a FACTORY RFC (about the factory's own know-how), not a product project.

> This document is **self-contained**. If the remediation orchestration dies mid-way,
> anyone can pick it up from here: it carries the full finding list with per-finding
> verdicts, the concrete fix for each, the approved preventive-mechanism design, and the
> ordered work plan.

---

## 1. Context — why this exists

### 1.1 The trigger bug
The owner asked the build engine to build **one** change. It built **two**. Root cause: two
authoritative rules contradicted each other —
- *"a targeted build (`--since` / a single change) builds only that"*, versus
- *"at each safe-point, drain everything that is ready in the queue"*.

Both were stated with authority, in different documents, and neither had been updated when the
other changed. The engine, following the drain rule, silently expanded the scope. **That specific
bug is already fixed today (2026-07-05)** (DR-069 targeted-scope). It is listed here only as the
*motivating example* — it is on the CLEAN list and must not be re-touched.

### 1.2 The audit
A 6-reviewer parallel audit of the factory corpus (`factory/`, `plugin/`, `docs/`, `AGENTS.md`,
`CLAUDE.md`) then found **~21 more instances of the same root pattern**:

> **Root pattern.** A contract/rule is declared with authority in one document, and silently
> contradicted by another document that was not updated in step. The contradiction is *accidental*
> — nobody intended two truths; one site simply drifted when the other was changed.

This weakens the factory: an autonomous agent that trusts rule A and another that trusts rule B
diverge, and the owner loses trust in the rule set. A second **hunting pass** produced 5 more
candidates; after dedup against the 21 and each other, 4 survive.

**Definition of contradiction used throughout** (binding): two authoritative, **current**,
mutually-exclusive statements. *Not* a contradiction: soft/hard tier distinctions, "default unless
X" patterns, or text explicitly marked as superseded/tombstoned. Point-in-time historical records
(dated decision-log entries) are never contradictions — they were true when written and are
append-only.

### 1.3 Already-audited CLEAN — do NOT touch
DR-085 operation→release supersession chains; DR-040 push-to-main; DR-082..084 tombstones; the
work-order state machine; global-wave vs per-FRD gate; DR-115 / constitution §25 (SSOT-as-law);
tap-target tiers; VERIFIED-is-never-rebuilt; hardening / phase-release ownership; and the
targeted-drain bug fixed today.

---

## 2. Findings — the full list with verdicts applied

Legend: **B**=blocker, **C**=confusing, **BK**=backup-family, **Cos**=cosmetic, **N**=net-new
(hunted). Verdicts: **confirmed** / **adjusted** (framing corrected) / **refuted** (dropped).

### 2.1 Blockers (confirmed)

| ID | Contradiction | The two current, mutually-exclusive statements |
|---|---|---|
| **B1** | Single front door broken | `change/SKILL.md:39` + `AGENTS.md:38` "one gate for the owner; **never** route to iterate/bug directly" (DR-069) **vs** `release/SKILL.md:8,36,42`, `review-launch/SKILL.md:22,24,31`, `adopt/SKILL.md:64`, `new-version/SKILL.md:9` all send the owner directly to `/pandacorp:iterate`; reinforced by `change/SKILL.md:39` + `iterate/SKILL.md:25` calling iterate a "direct alias". |
| **B2** | iterate writes the phase | `iterate/SKILL.md:20` auto-writes `phase: implementation` on a shipped project **vs** `work-orders/SKILL.md:30` "this skill must never move the phase; the architecture→implementation transition belongs to `/pandacorp:implement`" + DR-032 (no manual auto-advance). |
| **B3** | Unreachable researcher delegation | `backend-dev.md:16`, `frontend-dev.md:25`, `analytics.md:18` "delegate to the researcher agent instead of guessing" **vs** each agent's `tools:` frontmatter = `Read, Write, Edit, Grep, Glob, Bash` (no `Agent`/`Task`), and the engine never spawns a researcher for them → the instruction is unreachable. |
| **B4** | Orphan `phase: implementation` | `implement/SKILL.md:8` + `work-orders/SKILL.md:30` "`/implement` writes `phase: implementation` at start" **vs** the launch SOP `implement/SKILL.md:47` writes only `running`/`run_started_at`/`heartbeat`/`build.lock`, and the engine's only phase writes are `phase: release` at close-out (build.js ~1120) and "KEEP `phase: implementation`" on hardening failure (~1129). An architecture-approved project (`phase: architecture`) jumps straight to `phase: release`, never passing through `implementation`. |
| **B5** | Responsive-gate scope | `build-orchestration.md:333` (DR-074) "responsive gate is part of **both** the per-FRD gate and close-out" **vs** `build-orchestration.md:277-282` (DR-106) "in `--since` mode only smoke+shell run; visual+responsive belong to the full close-out run only". The engine implements DR-106 (per-FRD runs `verify.sh --since`, build.js ~500; comment ~171-183). |
| **B6** | `pending_changes` writer | `infra.md:61` "the gate writes `pending_changes` into `status.yaml`" **vs** `single-source-of-truth.md:21` which lists "a counter maintained by scattered increments instead of re-derivation (`pending_changes`)" as a **forbidden** pattern removed in the 2026-07-05 audit. The engine (build.js ~501/578) does not write it. |
| **B7** | `progress` field writer | `agent-portability.md:83` "update `status.yaml` (progress, last_green_sha)" **vs** `single-source-of-truth.md:22` "`progress` is a dead field displayed as truth — no writer". The engine never writes `progress`. |

### 2.2 Confusing (verdicts applied)

| ID | Verdict | Contradiction / adjusted framing |
|---|---|---|
| **C1** | **adjusted → omission** | `web-security.md:31` (public-web) "pin exact versions (no `^`/`~`)" governs pin **format**; `code-conventions.md:43` (DR-052, always-tier) states version **selection** (new→@latest, in-flight→don't churn, brownfield→latest compatible). Not mutually exclusive (you can select @latest **and** pin it). Real gap: the always-tier convention **omits** the exact-pin discipline. Frame as omission, not contradiction. |
| **C2** | confirmed | `reviewer.md:3,9` "does not edit production code / only test files" **vs** `reviewer.md:82` Visual-QA "FIX the cheap unambiguous gaps directly (size/spacing/color/token)". Same file, two hard rules. |
| **C3** | confirmed | `implement/SKILL.md:70` + `reviewer.md:9` "reviewer is a **different model** than the generator (DR-015)" **vs** `pandacorp-build.js:84` `PROFILES.pro = { worker:'sonnet', judge:'sonnet' }` → zero model diversity in pro mode. |
| **C4** | **adjusted → soft** | `bug/iterate/new-version` carry `user-invocable: false` (hidden from the owner's slash menu) while their bodies say "still works as a direct alias for the owner". Not strictly mutually exclusive (a hidden skill can still be invoked); a **discoverability** confusion (owner can't discover an alias the menu hides), not two hard contracts. |
| **C5** | confirmed | `implement/SKILL.md:22,29` reads a queue `status: needs-owner` **vs** `change/SKILL.md:30-31` + `bug/SKILL.md:21` whose enum is `draft`\|`ready` (+ engine-managed `building`\|`done`); `bug:21` explicitly "`pending` is not a queue status". `needs-owner` is a WO `blocked_reason` / change class, never a queue-status value → `implement` invents a non-existent enum member. |
| **C6** | **REFUTED — drop** | shadcn/ui is consistently the accessible component **base** (`constitution.md:32 §16`, `stack-a-nextjs/STACK.md:33`, `designer.md`, `frontend-dev.md:18`). DR-098/DR-058 govern the visual **look**, built **on top of** shadcn, exactly as §16 says. Only nit: `stack.md`'s golden-path-A summary line omits shadcn — an omission, folded into Cos1's family, not a contradiction. |
| **C7** | confirmed | `constitution.md:16 §6` "**Only** these 7 human gates … as hard deny-rules … **never** as conversational limits" **vs** the registry's ~18 `requiere_humano:true` DRs, several genuinely outside the 7 and operating as **conversational** approvals — esp. DR-002 (ADR/stack approval — "lightweight gate") and DR-032 (advance a phase column on the owner's "ok, advance"). Also DR-047, DR-081, DR-093/096. |
| **C8** | confirmed | `implement/SKILL.md:104` "responsive/visual — the per-FRD gates already enforced them" **vs** DR-106 + engine: only smoke+shell run per-FRD; responsive+visual run for the **first time** at close-out. (Same root as B5.) |
| **C9** | confirmed | `privacy.md:12` "encryption at-rest … golden path's managed DB (Neon/**Supabase**)" **vs** `stack.md:12` + `external-services.md:28` "Supabase evaluated and **rejected**, Neon chosen". |

### 2.3 Backup family (confirmed) — one root, chained

| ID | Contradiction |
|---|---|
| **BK1** | `infra.md:53` "the deploy machinery (`.pandacorp/run/serve.sh` + `deploy-local.sh`) is gitignored, regenerable runtime — but there is **no backup**" **vs** `backup-pandacorp-state.sh:75-81` (since v9.72.0) which now backs up `run/*.sh` (`for SH in $PD/run/*.sh; do … rsync`). The "no backup" claim is **stale**. |
| **BK2** | `check-unbacked-precious.sh:49` classifies **all** of `*/.pandacorp/run/*` as backed **vs** `backup-pandacorp-state.sh` only saving `run/*.sh` (~79-80) + `run/lessons.md` (~74). A future precious **non-`.sh`, non-`lessons.md`** file in `run/` would be classified "backed" while actually unbacked — the BL-0045 failure mode. |
| **BK3** | `check-unbacked-precious.sh:63` enumerates with `git ls-files --others --ignored --exclude-standard --directory`; `--directory` collapses the entirely-ignored `run/` dir to a single entry, so individual files inside are never listed — which **masks BK2**. Narrowing the BK2 rule closes it. |

### 2.4 Cosmetic

| ID | Verdict | Item |
|---|---|---|
| **Cos1** | confirmed | `README.md:26` "golden paths A/B/C/**D**" + `api-design.md:3` "stacks B/C/**D**" **vs** `stack.md:37` "old path D folded into C" — only A/B/C exist. (Absorbs C6's stack.md-summary omission nit.) |
| **Cos2** | **adjusted — do NOT rewrite** | `decision-log.md` v9.72.0 entry says the backup test is "6/6 green"; it now passes 8/8. But this is a **dated, append-only historical record** — it was true at v9.72.0, and the later v9.73.0 entry already records "grew a vault-detection case (8/8)". Per the definition, a point-in-time entry true when written is **not** a current contradiction; back-editing it would violate the decision-log discipline (DR-093). **No fix** — recorded for the critic so it doesn't re-flag. |

### 2.5 Net-new hunted findings (deduped)

All 4 survive dedup against the 21, against each other, and against the CLEAN list. Two of them
generalize the same *pattern* as C6/C9 (constitution names a rejected/unblessed technology) but are
**distinct instances**.

| ID | Verdict | Contradiction |
|---|---|---|
| **N1** | confirmed | **Portfolio-membership contract drift.** `adopt/SKILL.md:60` (+ `:58`) "add the `factory/portfolio.md` row **only once the build has started** … the portfolio is the index of projects *en obra y lanzados*; a project still in `architecture` gets its row when `/implement` begins" **vs** `scaffold/SKILL.md:31` which at **project birth** adds "the row (…, `product` phase, date)" and `spec/SKILL.md:14` which writes the "row in `factory/portfolio.md`" at `phase: product`. The **live artifact** confirms scaffold is operative: `factory/portfolio.md` header = "Índice de proyectos **creados** por la fábrica" (no build qualifier), and it carries `product`-phase rows. Mutually exclusive about which projects belong in the portfolio. |
| **N2** | confirmed | **Constitution sanctions Supabase Auth; standards bless only Better Auth.** `constitution.md:25 §12` "Never homemade auth: Better Auth / **Supabase Auth**" (two co-equal defaults) **vs** `auth.md:6` "**Better Auth is the golden path**; a different provider is a blueprint ADR" + the Supabase-rejected chain (`stack.md:12`, `external-services.md:13,28`). Standards sanction exactly one; constitution names two. Same root as C6/C9, distinct instance (auth provider). |
| **N3** | confirmed | **AGENTS.md rule 11 vs its cited authority disagree on the Codex JUDGE model.** `AGENTS.md:89` names three distinct model ids "gpt-5.4-mini/gpt-5.5/**gpt-5.5-high**" (JUDGE = `gpt-5.5-high`) and defers authority to `agent-portability.md` **vs** that cited standard `agent-portability.md:34-35` (PORT-2) mapping STANDARD=`gpt-5.5 (effort medium)` and JUDGE=`gpt-5.5 (effort high/xhigh)` — **same** model id, differentiated only by effort, no `gpt-5.5-high` model. Is JUDGE a distinct model or `gpt-5.5` at high effort? Summary and its own cited canonical source disagree. |
| **N4** | confirmed | **security-auditor is read-only but the engine requires it to FIX.** `security-auditor.md:5` `disallowedTools: Write, Edit` + `:10` "Audit and report — you don't edit code" + `:30` "reports findings with concrete remediation" **vs** `pandacorp-build.js:1111-1112` spawning `agentType:'pandacorp:security-auditor'` with "**FIX** every Critical/High finding directly (production code, TDD) … Return `{done:true}` ONLY when no Critical/High remains" + `implement/SKILL.md:102` "Critical/high findings are **fixed** before construction is declared complete". A `Write/Edit`-disallowed agent can never reach `done:true` on a real Critical/High finding → the Hardening phase stalls and `phase:release` is never set. **Latent** (LESSON-0022: the auditor has never run in a real build), so the *first* build to surface a Critical/High is where it deadlocks. |

---

## 3. Concrete fix per finding

> **Editing rules (binding).** Committed artifacts are English. Rule/template files projected into
> projects are edited at the **source** (`plugin/templates/...`), never a projected copy (DR-076).
> Before editing a cited `file:line`, verify the text is there (lines may have drifted — locate the
> equivalent). If `pandacorp-build.js` changes, `node plugin/scripts/test-pandacorp-build.mjs` must
> stay green (18/18). Do **not** git-commit and do **not** write decision-log entries — the
> consolidation step does both.

### Blockers
- **B1** — Enforce the single front door. In each site that routes the owner to `/pandacorp:iterate`
  (`release/SKILL.md:8,36,42`, `review-launch/SKILL.md:22,24,31`, `adopt/SKILL.md:64`,
  `new-version/SKILL.md:9`), replace the owner-facing route with **`/pandacorp:change`** (the front
  door that classifies feature/bug and files the queue card). Keep `iterate` described as the
  **internal engine behind `change`**, not an owner alias: soften `change/SKILL.md:39` and
  `iterate/SKILL.md:25` so "direct alias" no longer contradicts DR-069 (state that `iterate` is
  reachable by an agent/engine, not offered to the owner). Canonical owning docs: the skill files;
  decision-log: plugin.
- **B2** — Remove the phase write from `iterate`. `iterate/SKILL.md:20`: iterate must **not** write
  `phase: implementation` on a shipped project. It files the change into the queue (via the
  `change` front door / directly into `.pandacorp/inbox/changes/`); the **engine** owns the phase
  transition when the build launches. Reconcile with `work-orders/SKILL.md:30` (phase belongs to
  `/implement`). This interacts with B4 — see B4 for who actually writes the phase.
- **B3** — Make researcher delegation reachable **or** delete the instruction. Preferred:
  delete/soften the "delegate to the researcher agent" lines in `backend-dev.md:16`,
  `frontend-dev.md:25`, `analytics.md:18` to "do a focused `WebSearch`/read yourself; do not guess"
  (these agents have `Bash`+`WebSearch`-less toolsets — confirm each agent's tools; if `WebSearch`
  is absent, phrase as "read the docs in-repo / ask via a needs-owner decision, never guess").
  Alternatively wire an actual researcher sub-spawn — heavier, not recommended for this sweep.
- **B4** — Make the `phase: implementation` write real, at exactly one place. The engine's launch
  SOP (`implement/SKILL.md:47` and the build.js launch block) should set `phase: implementation`
  when the run starts (alongside `running:true`/heartbeat), so an architecture-approved project
  passes through `implementation` before `release`. Then `implement/SKILL.md:8` +
  `work-orders/SKILL.md:30` become true. Guard the build test (18/18) after touching build.js.
- **B5 / C8** — One responsive-gate scope. DR-106 is what the engine implements and is the intended
  behaviour (responsive+visual are close-out-only in `--since` mode). Fix the **stale** DR-074 line
  `build-orchestration.md:333`: it must say the responsive gate runs at **close-out** (full run),
  and at the per-FRD `--since` gate only smoke+shell run. Then fix `implement/SKILL.md:104`'s
  parenthetical: shell+smoke are enforced per-FRD; **responsive+visual are not** — reword to "the
  per-FRD gates enforced shell+smoke; this close-out is the first and whole-project run of
  responsive+visual".
- **B6** — Drop the forbidden writer. `infra.md:61`: remove `pending_changes` from the list of
  fields "the gate writes into `status.yaml`" (SSOT:21 forbids a stored counter; the count is
  re-derived from `.pandacorp/inbox/changes/`). Keep the queue itself; only remove the claim that a
  scattered-increment field is written.
- **B7** — Drop the dead field. `agent-portability.md:83`: remove `progress` from "update
  `status.yaml` (progress, last_green_sha)" — leave `last_green_sha` (real) and the per-status
  counts the engine actually writes. Reconcile with SSOT:22 ("`progress` has no writer").

### Confusing
- **C1** — Add the exact-pin discipline to the always-tier convention. `code-conventions.md:43`
  (DR-052): append that a selected version is **pinned exactly** (no `^`/`~`) in the lockfile,
  cross-referencing `web-security.md:31`. Framed as filling an omission, not resolving a
  contradiction.
- **C2** — Reconcile the reviewer's edit boundary. Two options; pick one and make all three lines
  agree: (a) narrow `reviewer.md:82` so Visual-QA only **reports** cheap gaps (writes the punch-list)
  and a Write/Edit-capable agent applies them — consistent with `:3,9` "test files only"; or (b)
  carve an explicit, bounded exception in `:3,9` ("except cheap unambiguous visual-QA
  size/spacing/color/token corrections against existing design docs"). (a) is cleaner and matches
  the engine's QA-Visual spawn shape.
- **C3** — Restore model diversity in pro mode (DR-015). `pandacorp-build.js:84`
  `PROFILES.pro`: make `judge` a **different** model from `worker` (e.g. worker `sonnet`, judge
  `opus`), or explicitly document a DR-015 exception for pro mode in `reviewer.md:9` +
  `implement/SKILL.md:70` ("in pro mode the gate trades model diversity for cost — accepted
  trade-off"). Diversity is the stated invariant, so restoring it is preferred. Guard 18/18.
- **C4** — Resolve the alias/hidden mismatch. In `bug/iterate/new-version` bodies, drop "still works
  as a direct alias for the owner" and state the truth: `user-invocable:false` hides them from the
  owner's slash menu; they are invoked by the engine / a skill / an agent, and the owner reaches
  their behaviour through the **front-door** skill (`change`, or `new-version` promoted explicitly).
  Aligns with B1.
- **C5** — Remove the invented enum member. `implement/SKILL.md:22,29`: replace the
  `status: needs-owner` queue-status reads with the real enum (`draft`\|`ready`; engine-managed
  `building`\|`done`). If the intent was "a change blocked awaiting the owner", express it as the
  WO's `blocked_reason: needs-owner` / a `needs-owner` **decision**, not a queue status. Reconcile
  with `change/SKILL.md:30-31` + `bug/SKILL.md:21`.
- **C6** — **Dropped** (refuted). No edit. Its stack.md-summary omission is handled under Cos1.
- **C7** — Reconcile the gate list with the registry. Preferred: broaden `constitution.md:16 §6`
  from an exhaustive "Only these 7, never conversational" to "these are the **hard-deny** gates;
  additional lightweight approval gates (ADR/stack — DR-002, phase-advance — DR-032, promotion —
  DR-047, sync-intent — DR-081, concurrency — DR-093/096) are defined in the registry and may be
  conversational". Cross-reference the registry. Alternative (heavier): re-classify the registry
  DRs — not recommended, the conversational gates are intended.
- **C8** — Fixed together with B5 (same edit to `implement/SKILL.md:104`).
- **C9** — Drop Supabase from the golden-path DB. `privacy.md:12`: "Neon/Supabase" → "Neon" (the
  chosen managed DB); Supabase was evaluated and rejected (`stack.md:12`).

### Backup family
- **BK1** — De-stale the backup claim. `infra.md:53`: replace "there is no backup" with the current
  truth — since v9.72.0 `backup-pandacorp-state.sh` backs up `run/*.sh` (+ `run/lessons.md`); the
  dir is still gitignored/regenerable and must never be deleted (BL-0035). Note the residual gap
  (non-`.sh` precious files, see BK2).
- **BK2** — Narrow the blanket blessing. `check-unbacked-precious.sh:49`: `is_backed_up` must return
  "backed" for `run/*.sh` and `run/lessons.md` **only**, not all of `run/*`. Any other precious file
  dropped in `run/` is then correctly flagged unbacked (closes the BL-0045 failure mode). Keep the
  backup manifest and this check in lockstep (that lockstep is exactly what this RFC's preventive
  gate enforces going forward).
- **BK3** — Enumerate files, not the dir. `check-unbacked-precious.sh:63`: drop `--directory` (or add
  a per-file walk under `run/`) so individual files inside the ignored `run/` are listed and BK2's
  narrowed rule is actually exercised. Fixing BK2 + BK3 together.

### Cosmetic
- **Cos1** — Retire path D. `README.md:26` "A/B/C/D" → "A/B/C"; `api-design.md:3` "stacks B/C/D" →
  "stacks B/C" (D folded into C, `stack.md:37`). Also add shadcn to stack.md's golden-path-A summary
  line (absorbs the C6 nit).
- **Cos2** — **No edit** (append-only historical record). Recorded so the critic does not re-flag.

### Net-new
- **N1** — One portfolio-membership rule. The **live data** (product-phase rows already in
  `factory/portfolio.md`, header "proyectos creados por la fábrica") + scaffold/spec both track from
  birth ⇒ canonical rule = **a portfolio row exists from project creation (`product` phase)**.
  Rewrite `adopt/SKILL.md:58,60` to add the row at adoption time for **any** inferred phase (matching
  the "board card ALWAYS" half it already states), dropping the "en obra y lanzados / only once
  building" definition. Keep `scaffold/SKILL.md:31` + `spec/SKILL.md:14` as-is. (`factory/portfolio.md`
  is gitignored owner state — do **not** rewrite its rows; the header already matches the canonical
  rule.) Touches: `plugin/skills/adopt/SKILL.md` (excluded-file → owned by the skill fixer group).
- **N2** — Drop Supabase Auth from the constitution. `constitution.md:25 §12`: "Never homemade auth:
  Better Auth / Supabase Auth" → "Never homemade auth: **Better Auth is the golden path** (a
  different provider is a blueprint ADR)". Same shape as C9 (DB) and the C6 nit. Touches
  `factory/constitution.md` (excluded-file → owned by the constitution fixer group).
- **N3** — Reconcile the Codex JUDGE-model naming. The canonical source is `agent-portability.md`
  (PORT-2), which uses **effort** as the axis (`gpt-5.5` at medium vs high/xhigh). Make the AGENTS.md
  summary match its own cited authority: `AGENTS.md:89` "gpt-5.4-mini/gpt-5.5/gpt-5.5-high" →
  "gpt-5.4-mini/gpt-5.5 (med)/gpt-5.5 (high effort)" (or "gpt-5.5-high-**effort**"). **Confirm with
  the owner** whether `gpt-5.5-high` is a genuine distinct model id before editing — if it is, the
  fix instead flips to updating `agent-portability.md:35`'s JUDGE cell. `AGENTS.md` is **not** an
  excluded file → returned as a newFinding; the `agent-portability.md` side (if that direction wins)
  is owned by the standards fixer group. `CLAUDE.md` carries no gpt-5 wording of its own (it imports
  AGENTS.md), so no CLAUDE.md edit is needed.
- **N4** — Split audit from fix. Cleanest: keep `security-auditor` **read-only** (audit + write the
  evidence file `docs/reviews/security-<date>.md` with findings only) and route the actual Critical/High
  code fixes to a `Write`/`Edit`-capable agent (`implementer`). Split the engine's Hardening 1/2
  (`pandacorp-build.js:1111-1112`) into: (1) an **audit** spawn (`security-auditor`, produces the
  report), then (2) a **fix** spawn (`implementer`, applies Critical/High fixes TDD until
  `verify.sh --since` is green). Update `implement/SKILL.md:102` + `BL-0012:72` to describe the
  two-step audit-then-fix. Alternative: make the auditor writable (remove `disallowedTools` +
  "you don't edit code" from `security-auditor.md`, add `Write,Edit`) — weaker, an auditor that edits
  the code it audits loses independence. Touches `plugin/agents/security-auditor.md` +
  `pandacorp-build.js` (both excluded → owned by the agents/engine fixer group). Guard 18/18.

---

## 4. Preventive mechanism — the supersession-completeness gate (approved design)

> This is **not** a blind anti-contradiction blocker. It is a *completeness* gate: it never blocks a
> rule change; it blocks an **incomplete propagation** of one.

**1. Distinguish two cases.**
- **Accidental** contradiction (two docs drifted, nobody intended it — the 21 above) → **catch it**.
- **Intentional** supersession (you *want* to change a rule) → **never block the change itself**.

**2. Freshly generated sets** (spec output = PRD + FRDs; architecture output = blueprint + WOs). A
**fresh** verifier agent (generator ≠ verifier) runs over the new set. A **hard internal
contradiction** (two acceptance criteria that cannot both hold; a WO contradicting its FRD)
**BLOCKS the close of the phase** — a fresh set has no supersession intent, it must come out
coherent. Analogous to the existing `readiness_gate` / `grounding_gate` in the architecture step
9b2.

**3. Edits to the EXISTING corpus** (change/iterate flows, and factory-rule changes e.g. via
`learn`): **do NOT block the change.** Instead require the supersession to be **COMPLETE**: the
author declares "I am replacing rule/claim X"; the verifier checks that **all** the places stating
the old claim were updated in the same change **AND** the *why* was recorded (the two-writes
discipline: canonical doc + decision log). **Block only INCOMPLETE PROPAGATION, never the change.**
The gate becomes the **ally** for changing a rule cleanly — exactly what would have prevented the 21
(DR-115 deleted `pending_changes` but did not update `infra.md`).

**4. Detection mechanism** (bounded, cheap, semantic — not a dumb grep). From the edited claim,
derive the **owning-doc set** via the canonical-doc table in `AGENTS.md` + the standards registry;
**grep** for the key terms of the OLD claim across `factory/`, `plugin/`, `docs/` to build a
**candidate** list; then a **verifier subagent** semantically reads **only** the candidates to judge
true contradictions vs noise. The author-declared supersession list **seeds** the search.

**5. Periodic advisory sweep.** A lightweight version of this audit (fan-out of reviewers over
corpus slices) documented as a **recurring advisory** job (a `/loop` job, or folded into the
`memory` review sweep) to catch drift that slips through. **Advisory, never blocking.**

### Deliverables (implemented, not just documented)
- **(a)** New standard **`factory/standards/document-consistency.md`** (standalone, cross-referenced
  from `documentation.md`) codifying the two cases, the fresh-set blocking rule, the
  supersession-completeness rule, and the detection mechanism.
- **(b)** New DR **DR-116** in `factory/decisions/registry.yaml` (next free number — verified: highest
  is DR-115) capturing the policy and its human-gate posture (advisory sweep = no gate; fresh-set
  contradiction = blocks phase close).
- **(c)** Wiring:
  - fresh-set **blocking verifier** step added to `plugin/skills/spec/SKILL.md` (over PRD+FRDs) and
    `plugin/skills/architecture/SKILL.md` (over blueprint+WOs) — mirroring the 9b2 gate shape;
  - **supersession-completeness** check added to `plugin/skills/change/SKILL.md`,
    `plugin/skills/iterate/SKILL.md`, and `plugin/skills/learn/SKILL.md` (author declares the
    superseded claim; verifier confirms full propagation + the two-writes record).
- **(d)** The **advisory periodic sweep** documented where recurring jobs live (the `/loop` +
  `memory`-review-sweep surface; reference from `document-consistency.md` and the recurring-jobs
  section).

---

## 5. Work plan / order

Do the fixes in groups (each group = one fixer subagent, tier noted), **then** build the preventive
gate, **then** consolidate plugin discipline, **then** run the completeness critic. No git commits
inside groups — a single consolidation step at the end commits everything and writes the
decision-log entries.

**Group order:**

1. **Fix group A — build engine + gates (JUDGE/opus, guard 18/18).** B4 (phase write), B5+C8
   (responsive scope, `build-orchestration.md` + `implement/SKILL.md`), C3 (pro-mode diversity,
   build.js), N4 (audit/fix split, `security-auditor.md` + build.js). Run
   `node plugin/scripts/test-pandacorp-build.mjs` after — must stay 18/18.
2. **Fix group B — skills / front door (JUDGE/opus).** B1 (single front door across release,
   review-launch, adopt, new-version, change, iterate), B2 (iterate phase write), C4
   (alias/hidden), C5 (queue enum), N1 (portfolio membership in adopt).
3. **Fix group C — agents (STANDARD/sonnet).** B3 (researcher delegation in backend/frontend/analytics
   agents), C2 (reviewer edit boundary).
4. **Fix group D — standards & constitution doc edits (STANDARD/sonnet).** B6 (`infra.md` pending_changes),
   B7 (`agent-portability.md` progress), C1 (`code-conventions.md` exact pin — edit at
   `plugin/templates/rules/` source, DR-076), C7 (`constitution.md` §6 gate list), C9 (`privacy.md`
   Supabase), N2 (`constitution.md` §12 auth), N3 (`AGENTS.md` Codex model — confirm direction w/ owner),
   Cos1 (`README.md` + `api-design.md` + stack.md path D / shadcn).
5. **Fix group E — backup family (STANDARD/sonnet).** BK1 (`infra.md:53`), BK2 + BK3
   (`check-unbacked-precious.sh`). Verify `test-backup-and-precious.sh` stays green after.
6. **Preventive gate build (JUDGE/opus).** Deliverables (a)–(d): the new standard, DR-116, the
   spec/architecture fresh-set verifier steps, the change/iterate/learn supersession-completeness
   steps, and the advisory-sweep doc.
7. **Plugin-discipline consolidation.** Bump `plugin/.claude-plugin/plugin.json` **and**
   `plugin/.codex-plugin/plugin.json` to the same new version (MINOR — new capability: the gate; per
   DR-034). If any `plugin/agents/*.md` changed (B3, C2, N4), regenerate the Codex mirrors:
   `node plugin/scripts/generate-codex-agents.mjs`. Ensure Mission Control's Manual reflects the new
   gate (DR-046). Then the consolidation step writes the decision-log entries (factory + plugin) and
   commits everything.
8. **Completeness critic (JUDGE/opus).** A fresh critic re-reads every finding above — including the
   excluded-file findings folded into this proposal (N1, N2, N4, and the build.js/agents/constitution
   fixes) and the two "no-edit" records (C6-dropped, Cos2-historical) — and confirms each is either
   fixed or correctly left alone, and that no new contradiction was introduced by the fixes
   themselves. This is a real run of the new gate against its own change set — the first exercise of
   the mechanism.

**Do-not-touch reminders:** the CLEAN list (§1.3); protected state paths (any `.pandacorp/`,
`factory/{ideas,memory,profile.md,portfolio.md}` — the portfolio's **rows** are owner state, only its
committed nature-of-the-artifact is discussed here); never git-commit inside a group; never
back-edit a dated decision-log entry (Cos2).
