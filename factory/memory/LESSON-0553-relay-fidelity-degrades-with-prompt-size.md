---
id: LESSON-0553
type: gotcha
domain: build-orchestration
tags: [haiku-relay, fidelity, checksum, prompt-size, model-tiers]
context: a MECH-tier relay (haiku) asked to copy/retype a larger agent's prompt or report verbatim into a file via the Write tool, rather than generating its own content
trigger: use this when designing or debugging a relay step that must reproduce another agent's text byte-exact (a prompt handoff, a report copy, a cross-runtime relay) — before trusting it worked without checking
source: "mission-control .pandacorp/run/lessons.md 2026-10-29 (agent-inferred, 2 notes): a haiku relay copied a 1.5 KB prompt with quotes/backticks/unicode exactly on the first try via the Write tool (verified with an FNV checksum), costing ~50k tokens/50s; a separate haiku relay could NOT retype an 8 KB prompt byte-exact (it silently changed 'this wo' to 'the wo'), recovered only by reading the relay transcript directly (with a checksum as proof) rather than trusting a model copy."
provenance: agent-inferred
created: 2026-10-29
status: candidate
promotion: none
confidence: low
times_applied: 0
applied_in: []
links: [LESSON-0507]
---

**Situation:** two same-day, contrasting observations of a haiku-tier relay asked to reproduce another
agent's text byte-exact via the Write tool: at ~1.5 KB (quotes, backticks, unicode) it succeeded exactly on
the first try (confirmed by an FNV checksum), but at ~8 KB it silently paraphrased a single short phrase
("this wo" → "the wo") — a one-word substitution invisible without a checksum, and not caught by a casual
read-through.

**Lesson:** a model-mediated relay's byte-exact fidelity is not a fixed guarantee — it can hold at a small
prompt size and quietly degrade at a larger one, producing a plausible-looking but NOT verbatim copy. A
relay step that needs verbatim fidelity (not just "roughly the same content") cannot be trusted by inspection
alone, regardless of how small the text looked in a prior successful case.

**Apply next time:** for any relay step whose correctness depends on byte-exact reproduction (a prompt
handoff between runtimes, a report copy, a checksum-sealed JSON relay per LESSON set around BL-0206), always
verify with a deterministic checksum (FNV, cyrb53, or similar) rather than trusting the model's own claim of
having copied it — and prefer reading the SOURCE transcript/file directly over asking a model to retype
large text, especially past a few KB.

**Corroborating data point (2026-10-31, same project — mission-control, agent-inferred):** past a certain
size the relay does not just quietly degrade (the 8 KB paraphrase above) — it stops working altogether. A
~132 KB planner answer never crossed the relay at all in the observed run. This suggests the degradation
curve this lesson tracks has a practical upper bound, not just a growing error rate: a call whose expected
output is on the order of 100+ KB should be planned to stay on a NATIVE agent from the start (no
model-mediated relay step), rather than discovered to have failed after the fact. Still single-project
evidence; the exact size where "degrades" turns into "never completes" is unmeasured.
