---
id: LESSON-0442
type: library-verdict
domain: agent-portability
tags: [dr-120, codex, sole-writer, cross-runtime, build-safety, policy-event]
context: the owner lifting DR-120 (Claude-only build-state writes) PER PROJECT, as a one-off capacity decision, when the Claude weekly usage limit hit 96% mid-build
trigger: use this when evaluating whether to let Codex (or another non-Claude runtime) write build state as sole writer under an owner-granted exception, or when reviewing evidence for whether DR-120/PORT-5's freeze should reopen
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-19, owner-stated override + agent-inferred quality findings (5 WOs, gpt-6-astra/6.1-sol/6-luna via codex-cli 0.163.0)"
provenance: owner-stated
created: 2026-10-19
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0067, LESSON-0437]
---

> **Policy supersession, 2026-10-20 (DR-133):** historical DR-120 read-only/freeze language below is not current authorization. Codex and Claude Code now have full native attended access to every skill/application; automation evidence and safety requirements remain separate.


**IMPORTANT — flagged contradiction, not silently resolved:** `factory/standards/agent-portability.md`
(PORT-5) and `AGENTS.md` currently state DR-120's non-Claude build-write ban is FROZEN as of
2026-09-02, with a VERBATIM reopen trigger ("Codex ships wake-capable local scheduling") — not "the
owner can lift it per-project for a capacity reason." The event this lesson records (owner lifting
DR-120 for funko-tracker on 2026-10-19 because the Claude weekly limit hit 96%) does not match that
stated trigger. This is evidence for a POLICY decision, not a policy change itself — the librarian is
recording it and surfacing the conflict for the owner/`/pandacorp:learn`, not editing PORT-5.

**Situation:** with Claude's weekly usage limit at 96% mid-build, the owner authorized Codex to build the
remaining 5 work orders of funko-tracker as SOLE WRITER, in per-WO worktrees, gated by `verify.sh
--since` + a Claude review step, with full `VERIFIED` status reserved for the Claude engine's own opus
gates.

**Lesson (quality verdict):** all 5 WOs delivered with their own gate green and their ACs claimed.
Positive signals: Astra (gpt-6-astra) stopped on an under-declared cross-FRD scope instead of overreaching
past its WO's boundary (good judgment, see the related architecture gap filed as BL-0262); a SEPARATE
Codex re-check of FRD-06 (a data-integrity FRD) using gpt-6-astra as an independent reviewer found 4
clause violations that Claude's own opus FRD-06 gate had already certified past — real, cross-runtime
recall (see LESSON-0067, now cross-project corroborated by this same incident). Negative signal: 2 of the
5 WOs edited verbatim-ported CSS (`src/styles/*`, an ADR-protected invariant) that `verify.sh --since`
structurally cannot see (see LESSON-0437) — caught only by a FULL verify run and fixed by the human
integrator, not by any gate in the loop.

**Apply next time:** a non-Claude runtime building as sole writer under an owner-granted exception is
usable for real work WHEN (1) the brief explicitly names the project's own protected invariants (what
must never be edited) up front, and (2) the integrator runs the FULL, non-`--since` gate before landing
anything from outside the normal engine — never rely on the scoped fast gate alone to catch a violation
of a file-level contract it was never designed to see. Operational CLI notes from this same run: see
LESSON-0325 (codex-cli version/model gotchas, now including a 4th corroborating instance).
