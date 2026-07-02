# 22 — Design skill audit & upgrade plan (2026-07-01)

**Trigger:** owner request after the `personal-page-v2` (Personal Page B2B) design phase, which used
Claude Design and required heavy manual iteration: a flat/boring first system, missing components in
the design system, skipped screens the owner had to ask for one by one, and a copy-paste relay loop
(the agent writes a prompt → the owner pastes it into the canvas → the owner reports back → repeat).

**Evidence audited:** `plugin/skills/design/SKILL.md` + `references/surface-playbooks.md`,
`factory/standards/design.md` (§1c, §7, §9–§12), `factory/decisions/registry.yaml` (DR-054/056/057/
058/062/074/075/101), plugin decision log (v9.24.0→v9.27.0), the full artifact tree of
`personal-page-v2` (`docs/design/`, all 8 FRDs, `_ds_manifest.json`, `.pandacorp/comms/iteration.md`,
`status.yaml`), and the `DesignSync` tool's real capabilities. The claude.ai "Pandacorp Design"
canvas conversations themselves are not readable from a Claude Code session — the reconstruction
comes from the artifacts + the lessons already codified from that session.

---

## 1. Findings

### F1 — Most of the pain is ALREADY codified; the fix has never been battle-tested

The failures the owner experienced on 2026-06-27/28 (thin brief → flat system with link-colour as
the only transition; component gallery deferred; only the landing generated; ambiguous prompts
leaving stray text; the conversion CTA shipped as a tiny link) were captured the same days into
DR-058 (corrected) + DR-101 (plugin v9.24.0→v9.27.0): the anti-omission completeness checklist
(§1c), the two-stage cadence with the full screen set enumerated from the FRDs (§11), explicit
prompts, weight=importance (§9), real content (§10), the per-screen rubric (§12), and the
per-surface playbooks. **The current skill is not the one that produced the pain — but no new
project has exercised it yet.** The plan below assumes those rules as the baseline and does NOT
re-legislate them.

### F2 — The relay loop is the top remaining friction, and it is only partly irreducible

The generative engine is the owner-driven canvas; the agent cannot pilot it (verified: `DesignSync`
is file-sync only). But the current procedure makes the OWNER the bus for every message in both
directions, when only one direction actually requires them:

- **Outbound (prompt → canvas):** genuinely needs a human paste today. It can be reduced to a
  single Cmd+V per round (clipboard hand-off), and possibly to zero via browser automation
  (claude-in-chrome can navigate, fill and submit on claude.ai in the owner's own logged-in
  browser) — unverified, needs a spike.
- **Inbound (canvas output → agent):** needs **no human at all** — the agent can poll
  `DesignSync list_files` for changed/new files and auto-trigger the pull-and-review the moment
  generation lands. Today the skill waits for the owner to say "ya está", which is pure waste.

### F3 — The iteration journal lied: canvas rounds left no trace

`personal-page-v2`'s `.pandacorp/comms/iteration.md` records the design phase as **one clean
round**, while the owner lived many painful ones. The back-and-forth happened in the canvas —
outside the session — and the skill never journaled it. This breaks DR-032's promise (the essence of
the back-and-forth is persisted; re-running refines instead of repeating what was discarded) and
makes any later audit read a false history. Same class as the "verify before telling" rule: an
external-tool loop must be journaled by the skill that drives it.

### F4 — The skill is Opus-shaped: mega-paragraph procedure, state held in context

The EXPLORE+Claude-Design procedure lives in ONE ~700-word paragraph inside Step 0 (SKILL.md:18),
plus mirror text in the Rules section. Completeness (every screen generated, every rubric check run,
every component back-ported) relies on the model holding the whole checklist in working memory
across a many-round, human-paced loop. Opus mostly survives that; Sonnet will drop items. The
reliable pattern the factory already uses elsewhere (work-order frontmatter, Build Plan) is
**externalized state**: a tracker file on disk that a dumb check can verify, so completeness is
enforced by a file, not by attention.

### F5 — "Components appeared in screens but never in the system" has no closing sweep

Rubric #12-9 checks `@dsCard` presence per screen, and §1c forces the gallery up front. But nothing
reconciles, at the END of Stage 2, the union of components actually used across all generated
screens against the Stage-1 gallery + `components.md`. That is exactly the owner's report (project
card, CTAs missing from the system; screens using pieces the system never defined). One explicit
bidirectional sweep closes it.

### F6 — HTML vs Claude Design: right instinct, no codified decision rule

DR-058 says "preferred when available; offer, don't force". The owner's own criteria (Claude Design
output was excellent and implementation fidelity from it was high; HTML mockups historically
diverged at implementation; HTML still needed when there's no canvas access, or on a brownfield
project where regenerating everything is absurd) are better than what's written. Codify the routing
so any model picks the same path.

---

## 2. Plan

### Phase A — Close the loop mechanically (no new dependencies) — P0

**A1. Inbound automation — poll, don't ask.** After handing a generation prompt, the skill snapshots
`list_files` (paths + timestamps), then polls DesignSync at a sane cadence. When the file set
changes and stabilizes, it auto-runs the pull-and-review (§12 rubric) and either hands the next
corrective/screen prompt or presents the reviewed result. The owner never reports "ya generó".

**A2. Outbound semi-automation — one Cmd+V per round.** Each canvas prompt is (a) written to
`docs/design/canvas/prompts/NNN-<slug>.md` (provenance, F3) and (b) piped to `pbcopy` with a short
notification: *"Prompt N listo en el portapapeles — pégalo en el canvas."* The owner's entire job
per round becomes: switch tab, Cmd+V, Enter.

**A3. Canvas journal.** Every round appends one line to `docs/design/canvas/log.md` (round #, prompt
file, files changed, rubric verdict, corrective actions) AND the skill appends the design-phase
essence to `.pandacorp/comms/iteration.md` as DR-032 already mandates — external-tool rounds
included. An audit must never again read "1 clean round" over a 15-round reality.

### Phase B — Sonnet-proofing: externalize the state, shrink the prose — P0

**B1. The screen tracker is a FILE, not attention.** At Stage-2 start the skill materializes
`docs/design/canvas/tracker.md`: one row per deliverable (design system + every `ui:true` FRD
screen) × status (`pending → generated → reviewed → corrected → owner-approved`) × rubric result ×
prompt file. Every round updates it. **The Step-9 advance gate checks the tracker**: any row not
`owner-approved` (or explicitly deferred by the owner) = not advanceable — same mechanism class as
the DR-054 artifact-existence check. This makes "se saltaron páginas" structurally impossible on any
model.

**B2. Restructure the procedure into a reference algorithm.** Move the mega-paragraph
(SKILL.md:18 + the twin Rules bullets) into
`plugin/skills/design/references/canvas-procedure.md` as a numbered, stateful algorithm
(setup → upload context → Stage 1 loop → Stage 2 per-screen loop → closing sweep → integrate), each
step with its precondition and its on-disk artifact. SKILL.md keeps a ~10-line summary + the
pointer. Rationale: dense duplicated prose is where small models diverge; one numbered algorithm
with file-backed checkpoints is where they converge. (Same treatment the build engine got.)

**B3. Closing reconciliation sweep (F5).** New mandatory last step of Stage 2: extract the union of
components/patterns used across ALL generated screens; diff against the Stage-1 gallery +
`_ds_manifest.json`; for each orphan, issue a back-port prompt (add it to the system gallery) or
record a justified exception; only then bridge the manifest → `components.md`. Add as rubric row #11
and as a tracker row of its own.

### Phase C — Autopilot spike: drive the canvas via claude-in-chrome — P1

Verify in ONE interactive session whether the agent can, in the owner's logged-in browser: open the
design project, paste/submit a prompt into the canvas chat, and detect completion. If YES → wire as
the preferred outbound transport (Vía A), demoting A2's clipboard to fallback; human gates stay
exactly where they are (Stage-1 system approval, per-screen owner gate, advance gate) — automation
moves the *messages*, never the *decisions*. If NO (canvas UI too fragile / extension absent) → A2
remains the floor and this is recorded in the standard so nobody re-spikes it blind. Outcome
recorded either way in `factory/standards/design.md` §1c.

### Phase D — Codify the engine routing (HTML vs Claude Design) — P1

Decision table in `factory/standards/design.md` §1c + SKILL.md Step 0:

| Situation | Engine |
|---|---|
| EXPLORE, greenfield, canvas auth available | **Claude Design** (default) |
| EXPLORE, no canvas access / headless session | Hand-authored HTML directions (current Steps 4–6) |
| ADOPT-VISUAL (approved visual exists) | Neither generates: extract; optional push UP for management |
| Brownfield with substantial built UI | HTML/in-repo iteration on the frozen system; canvas only for genuinely new surfaces |
| Post-freeze per-FRD iteration (small change) | In-repo on frozen tokens; re-sync mirror per DR-081 if CD provenance |

Plus the owner's observed rationale as a note: implementation fidelity from Claude Design output was
HIGH (React-shaped, token-clean) while hand-HTML historically diverged — that's the reason for the
default, not fashion.

### Phase E — Validation — P1

Run the upgraded path end-to-end on the next project with UI (or a synthetic mini-project) **once on
Opus and once on Sonnet**, comparing tracker completeness, rounds-to-approval, and owner
interventions. The skill is "fixed" only when a Sonnet run completes the tracker without the owner
having to ask for a missing page or component — the DR-101 rules finally get their battle test.

---

## 3. Effort & order

| Phase | Size | Depends on |
|---|---|---|
| A (poll + clipboard + journal) | S — skill text + procedure file | — |
| B (tracker + restructure + sweep) | M — skill restructure + gate hook | A (same files) |
| C (chrome spike) | S spike, M if wired | A |
| D (routing table) | XS | — |
| E (validation run) | M | A+B |

A+B+D land together as one plugin MINOR (they touch the same SKILL.md/standard sections). C is a
separate session (needs the owner's browser). E rides the next real project.

**Non-goals:** re-legislating DR-101/DR-058 content rules (done); replacing the owner's gates
(automation moves messages, not decisions); building a Claude-API generator to bypass the canvas
(the canvas IS the product's value: live preview + the owner's visual judgment).
