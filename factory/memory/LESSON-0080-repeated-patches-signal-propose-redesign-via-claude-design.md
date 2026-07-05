---
id: LESSON-0080
type: pattern
domain: design-process
tags: [claude-design, designsync, redesign, patch-fatigue, escape-hatch]
context: a component has already absorbed 2+ narrow code-only patches for the same class of visual issue (e.g. contrast) and a 3rd similar patch is about to be applied
trigger: use this when a reviewer/build is about to apply a 3rd (or later) narrow code-only fix to the same component for the same recurring class of issue
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-07-04 — Lightbox needed 2 separate contrast fixes; instead of a 3rd patch, drafted a Claude Design brief grounded in the component's real source (props/CSS classes/behavior, not guessed), had the owner run it on the canvas, then pulled the result back via DesignSync get_file and ported it"
provenance: agent-inferred
created: 2026-07-05
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0026]
---

**Situation:** a component (a Lightbox) had already needed two separate, narrow code-only fixes for
the same underlying issue class (contrast). Rather than applying a third symptom-level patch, the
agent drafted a self-contained Claude Design brief — grounded in the component's ACTUAL current
behavior/props/CSS classes read from source (not guessed or described from memory) — had the owner run
it on the Claude Design canvas, then pulled the redesigned result back into the codebase via
DesignSync's `get_file` and ported it.

**Lesson:** two or more narrow patches to the same component for the same recurring symptom class is a
signal that the component's underlying design (not just its code) is the actual problem — continuing
to patch treats the symptom, not the cause. Claude Design + DesignSync is a viable, low-friction escape
hatch for this: it lets an agent hand off a REAL design pass (grounded in the component's true current
implementation) to the owner's canvas and pull back a concrete result, without derailing the build into
open-ended design exploration in-session.

**Apply next time:** when a component is about to receive a 3rd+ patch for the same recurring issue
class (visual or otherwise), pause and propose a real design pass instead of the next patch. Ground the
brief in the component's actual current source (props, CSS classes, real behavior) so the canvas result
is portable back with minimal translation, then round-trip it via Claude Design + DesignSync
(`get_file`) rather than iterating further in code alone.
