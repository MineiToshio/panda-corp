# Canvas procedure — EXPLORE path with Claude Design (DR-058, DR-101, DR-109)

The numbered, stateful algorithm for generating a design system + the full screen set on the
claude.ai/design canvas. The skill follows it **step by step, in order**; every checkpoint lives in a
FILE, never only in the conversation — completeness is enforced by the tracker + the advance gate,
not by attention. Content rules (what a complete system contains, hierarchy, real content, prompt
discipline, the rubric) are canonical in `factory/standards/design.md` §1c + §9–§12; this file is the
DRIVING procedure.

## Facts (do not re-derive; verified 2026-06-27)

- The **generative engine is the web canvas** (claude.ai/design). The agent cannot pilot it via API.
- The **`DesignSync` tool is file sync only**: `list_projects` / `get_project` / `list_files` /
  `get_file` / `create_project` / `finalize_plan` / `write_files` / `delete_files`.
- Auth: one-time `/design-login` in an interactive terminal (not headless). Never assert a slash
  command exists from a filesystem search — defer to the owner's autocomplete.
- Outbound transport (a prompt reaching the canvas chat) is resolved by DR-109's ladder (§ Relay).
- Plan B when the session can't authorise: the owner generates on the canvas + "Send to Claude Code
  Web", or runs `/design-sync` from their terminal.

## On-disk state (create at Stage-1 start)

```
docs/design/canvas/
  tracker.md        # THE completeness contract — one row per deliverable (see format below)
  log.md            # one line per round: round #, prompt file, files changed, verdict, actions
  prompts/          # every prompt handed to the canvas, numbered: NNN-<slug>.md
```

`tracker.md` format — one table, statuses strictly from this set
(`pending → generated → reviewed → corrected → owner-approved`, or `deferred(owner)`):

```markdown
| # | Deliverable            | FRD    | Status         | Rubric   | Prompts        |
|---|------------------------|--------|----------------|----------|----------------|
| 0 | Design system (Stage 1)| —      | owner-approved | §1c pass | 001, 003       |
| 1 | Home                   | FRD-02 | reviewed       | 9/10     | 004, 007       |
```

Row 0 is always the design system. Rows 1..N are enumerated **from the FRDs** (every `ui:true` FRD →
its screen(s), per the FRD screen→mock mapping) **before Stage 2 begins** — never discovered as you
go. The **last row is always `Closing sweep`** (step 7). The Step-9 advance gate refuses to advance
while any row is not `owner-approved` or `deferred(owner)`.

## Relay mechanics (DR-109)

**Outbound (agent → canvas) — transport ladder, best available wins:**
1. **Browser (claude-in-chrome), when connected and the owner allowed it:** the agent opens the
   design project's chat in the owner's logged-in browser, pastes the prompt and submits it. Zero
   owner action per round; the owner keeps only the decision gates.
2. **Clipboard (default floor, macOS):** write the prompt to `docs/design/canvas/prompts/NNN-<slug>.md`,
   pipe it with `pbcopy < <file>`, and tell the owner (Spanish): *"Prompt NNN listo en el
   portapapeles — pégalo en el chat del canvas y envíalo."* One Cmd+V per round.
3. **Manual (fallback):** show the prompt in the conversation for the owner to copy.

The prompt FILE is written in every case (provenance — the journal must reconstruct the round).

**Inbound (canvas → agent) — poll, never ask.** Immediately after hand-off:
1. Snapshot `DesignSync list_files` (paths, sizes/timestamps) as the round's baseline.
2. Poll `list_files` on a lazy cadence (≈60–90s; canvas generation takes minutes). Change detected =
   the file set or metadata differs from baseline.
3. Wait for **stabilization**: two consecutive identical polls after a change → generation done.
4. Auto-trigger the pull-and-review (steps 4/6 below). **Never** ask the owner "¿ya generó?" — the
   only questions the owner gets are decisions (approve / correct / defer).
5. Give up politely after ~15 min of no change: tell the owner what you were waiting for and keep
   polling in the background if the session allows.

## Journal (DR-032 applies to EXTERNAL rounds too)

After **every** round (prompt handed, files pulled, review verdict, corrective issued): append one
line to `docs/design/canvas/log.md` and update `tracker.md`. At each owner gate and at phase end,
append the round's **essence** (what was tried / rejected and why / still open — in Spanish) to
`.pandacorp/comms/iteration.md`. A canvas iteration that leaves no trace in the journal is a defect:
it makes re-runs repeat discarded work and audits read a false history (personal-page-v2 read as
"1 clean round" over a many-round reality).

## The algorithm

**1. Setup.**
   a. `list_projects`; no design-system project for this app → `create_project`.
   b. Create `docs/design/canvas/{tracker.md,log.md,prompts/}`; seed tracker row 0 (`Design system`,
      `pending`) + one row per screen enumerated from the FRDs + the final `Closing sweep` row.
   c. Resolve the outbound transport (ladder above) and record it in `log.md`.
   d. **Author the master brief — `docs/design/claude-design-brief.md` (the `designer` agent).** Before
      any canvas prompt, the `designer` writes the brief that becomes the canvas's top input (uploaded in
      step 2). It **MUST require and reference** the anti-omission completeness checklist in
      `factory/standards/design.md` §1c **by pointer — never copy §1c into the brief** (§1c is the single
      source of truth, DR-115): the brief points the canvas at §1c and obliges every item in it. It also
      states the **qualitative token direction** the canvas proposes the palette from (mood, dark-default +
      first-class light, one rationed accent, OKLCH, AA both themes) and the **`target_platforms`
      breakpoints** (§4b: `desktop` / `mobile` / `responsive` → the exact widths to generate at).
      Synthesize it from SKILL.md Steps 1–3 (`references.md`, the token groundwork, `voice-and-tone.md` +
      `microcopy.md`) — those MUST already be done.

**2. Upload ALL context** the canvas needs, as markdown, via `finalize_plan` + `write_files`: the
   master brief (`claude-design-brief.md`, authored in step 1.d) + `microcopy.md` + `voice-and-tone.md` + `references.md`
   + the per-surface playbooks (`surface-playbooks.md`). Keep the uploaded brief in sync whenever
   the direction changes. (Steps 1–3 of SKILL.md — research, tokens groundwork, voice/microcopy —
   MUST already be done: they produce these inputs.)

**3. Stage 1 — the design SYSTEM (one exhaustive prompt).** **Precondition (fail-closed): the master
   brief `docs/design/claude-design-brief.md` exists and covers §1c by reference (step 1.d) — do NOT
   start Stage 1 without it.** Build ONE generation prompt from the
   §1c anti-omission checklist (every component + every state + placeholders + mandatory motion +
   breakpoints by `target_platforms` + hierarchy + real content). Hand it off (Relay). Poll.

**4. Stage-1 pull-and-review loop.** On stabilization: pull (`list_files`/`get_file`) and review
   against the FULL §1c checklist — from the actual files, never memory. Any miss → a corrective
   prompt (explicit: name the element, the action, what stays — §11) → hand off → poll → re-review.
   When the checklist passes → present to the owner (Spanish) → owner approves the SYSTEM → tracker
   row 0 = `owner-approved`. Journal every round.

**5. Stage 2 — ALL the screens, one at a time, tracker-driven.** For each `pending` tracker row in
   order: build that screen's prompt carrying its surface playbook + the §9/§10 constraints; hand
   off; poll.

**6. Per-screen pull-and-review loop.** On stabilization: pull the screen file and score it against
   the §12 rubric (all 10 checks). Fail → corrective prompt → repeat (row = `corrected`). Pass →
   row = `reviewed`, present to the owner; on their ok → `owner-approved`. The owner must never
   have to ask "where are the other pages?" — the tracker's pending rows are YOUR queue, not theirs.

**7. Closing sweep — bidirectional component reconciliation (DR-109).** When every screen row is
   `owner-approved`/`deferred`: extract the union of components/patterns actually used across ALL
   generated screens; diff BOTH directions against the Stage-1 gallery + `_ds_manifest.json`:
   - used in a screen but absent from the system → back-port prompt (add it to the gallery) or a
     recorded, justified exception;
   - in the system but used nowhere → confirm intentional (a state variant) or prune.
   Only a clean sweep marks the `Closing sweep` row `owner-approved`. This is the check that kills
   "the project card / CTAs appeared in pages but never in the design system".

**8. Integrate.** Tokens → `docs/design/design-tokens.json` + root `DESIGN.md` (agent verifies AA
   both themes and freezes); `_ds_manifest.json` → `docs/design/components.md` (DR-057); export the
   canvas files into `docs/design/prototype/`. **Run the SAME automatic verification as SKILL.md Step 5
   over the exported `docs/design/prototype/*.html`** — Playwright screenshots at 375px/1280px →
   `docs/design/prototype/screenshots/` + axe-core → `docs/design/a11y-report.md`; fix serious
   violations before the owner gate. Both artifacts are **fail-closed at the SKILL.md Step-9 advance
   gate** (their absence means this verification never ran). Then shard per FRD (SKILL.md Step 8). Close
   the canvas thread in `iteration.md`.

## Failure modes → what to do

| Symptom | Action |
|---|---|
| `DesignSync` unauthorised / headless session | Plan B (owner drives canvas + "Send to Claude Code Web"), or owner runs `/design-login` interactively once |
| Canvas silently changed OTHER files than asked | Diff the poll snapshot; review the collateral files too before the gate |
| A corrective prompt regressed something | Prompts must state what STAYS (§11); re-issue explicitly; journal the regression |
| Owner asks for a screen not in the tracker | Add a row (scope grew) — never generate untracked deliverables |
