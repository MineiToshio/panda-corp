---
id: LESSON-0152
type: gotcha
domain: agent-orchestration
tags: [prompt-engineering, parsing, contract, canary, r11]
context: a deterministic parser/gate expects a specific heading or schema in model-generated output, and a live canary run is the first time real model output is checked against it
trigger: use this when a prompt asks a model to produce a section a deterministic script will then parse (a heading, a fenced block, a required key)
source: "panda-corp R11 first live canary, 2026-07-11 — factory/decision-log.md 'R11 separates accelerated, short-live and overnight evidence' entry ('a real canary also caught a prompt heading that disagreed with the deterministic gate'). Corroborated 2026-10-16 (Mission Control, agent-inferred): the same mismatch recurred on the fixture side rather than the prompt side — SpecDigest test fixtures used a bold label the real parser vocabulary didn't define (expects '**Overview:**' for FRD detail), so an unknown label silently produced a title-only modal; caught only by opening the modal in a real browser and checking its populated content, not by the fixture's own presence."
provenance: agent-inferred
created: 2026-07-12
status: active
promotion: approved
confidence: medium
times_applied: 4
applied_in: [panda-corp, personal-page-v2, pandasaga, funko-tracker]
links: ["factory/standards/quality.md (QUAL-14, owner-attended live attempts — promoted 2026-07-15, /pandacorp:learn)"]
---

**Situation:** R11's first REAL live canary (not a mock) asked a model to produce "Verification
evidence" in its output, while the deterministic controller that parsed the result required a
standalone `## Verification` heading. The model's output was semantically correct and would have read
fine to a human, but the parser rejected it because the literal text didn't match — a failure that
`OFFLINE_ACCELERATED` mock-worker tests never caught, because the mock always emits the exact expected
literal.

**Lesson:** a mock/fixture-driven test proves the STATE MACHINE around a model-facing contract, never
the contract's actual wording — a mock always speaks the parser's exact dialect by construction. Only a
REAL model call can catch a prompt/parser wording mismatch, because only a real model has room to
paraphrase. This is why the factory's evidence tiers (`OFFLINE_ACCELERATED` / `LIVE_SHORT` /
`LIVE_OVERNIGHT`) are kept distinct rather than treating a green mock suite as sufficient — mocks and
reality can diverge on exactly this seam.

**Apply next time:** when a prompt asks a model to produce output a deterministic script will parse,
name the EXACT heading/schema/literal in the prompt itself (not a paraphrase of it), and keep at least
one REAL (non-mocked) canary in the test matrix that exercises the actual prompt-to-parser round trip —
a fully-mocked suite cannot catch this class of defect by construction. The same wording-mismatch risk
applies to TEST FIXTURES authored by hand for a parser's expected input: a fixture using a plausible but
wrong label/heading (not the parser's actual published vocabulary) can produce a silently degraded
result (e.g. a title-only modal) that looks present but isn't populated — verify the fixture's real
rendered output in a browser, not just that the fixture file exists.
