---
id: LESSON-0504
type: library-verdict
domain: model-selection
tags: [dr-111, model-tiering, haiku, sonnet, opus, fable, calibration, effort]
context: choosing a subagent's model tier and effort level under DR-111/CONV-12, when the instinct is to
  assume a simple hierarchy ("Opus always better", "Sonnet always cheaper for the same quality")
trigger: use this when sizing a subagent's model+effort under DR-111/CONV-12 and tempted to pick purely
  by a fixed "better model = better result" assumption rather than by task type
source: "mission-control .pandacorp/run/lessons.md 2026-10-22, two corroborating findings from the same
  calibration session: (owner-stated hypothesis, agent-checked) published AA Intelligence Index data
  (secondary report, Claude Sonnet/Opus 5.5) shows Opus-low priced/scored near Sonnet-medium, Opus-medium
  beats Sonnet-high, and Sonnet-xhigh/max cost MORE than Opus at equal score; AND (agent-inferred) an own
  bench (Haiku/Sonnet/Opus 5.5, 3 task families + a 2-rep hard bug hunt) measured: clear-spec/documented
  tasks saturate at 100% even for Haiku-low (only unguided review separates models); effort buys care on
  state-tracing bugs, model buys knowledge (one hard DST bug: Opus 8/8, Sonnet 1/8, Haiku 1/6); Opus-low
  ~ Sonnet-high in recall; Sonnet-xhigh never beat Opus-high; repeating one config repeats its blind
  spots, but 3 Haiku passes at DIFFERENT efforts covered 10/10. A third finding (agent-inferred, same
  session): Fable 5.1 on the hard bug hunt (2 reps) scored medium=10/10 (matching Opus-xhigh at the same
  wall time, ~2-2.5x the per-token price) but low=8.5, BELOW Opus-low's 9.0 — contradicting a vendor
  guide's claim that Fable-low is competitive with Opus/Sonnet; recommend reaching for Fable only at the
  frontier, after Opus-xhigh already falls short."
provenance: owner-stated
created: 2026-10-23
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: [mission-control]
links: [LESSON-0159, LESSON-0176, LESSON-0075]
---

**Situation:** two independent sources measured the same underlying question — does raising model tier or
effort level monotonically improve outcomes, in a way that lets you just "pick the best affordable tier"?
A published third-party index (Claude Sonnet/Opus 5.5 pricing/score data) and an own bench (Haiku/Sonnet/
Opus 5.5 across 3 task families plus a 2-rep hard bug hunt, extended with Fable 5.1 on the same hunt) both
answered no.

**Lesson:** model/effort choice is empirical, not a fixed ladder. Concretely: (1) clear-spec/documented
tasks saturate near 100% even at the cheapest tier/effort (Haiku-low) — only genuinely unguided/judgment
review work separates models at all; (2) **effort buys care** (surfacing state-tracing bugs through more
careful re-reading) while **model buys knowledge** (a model that has simply seen more of the relevant
pattern finds a bug a cheaper model structurally can't, regardless of effort); (3) the tiers overlap in
practice — Opus-low can match Sonnet-high, and Sonnet at its MOST expensive effort (xhigh/max) can cost
more than Opus while scoring the same or worse; (4) the most expensive tier (Fable-class) is not
uniformly best either — its medium effort matched Opus-xhigh at the same wall time but ~2-2.5x the
per-token price, while its LOW effort scored below Opus-low, contradicting a vendor claim that
Fable-low is broadly competitive; reserve Fable for the genuine frontier, after a cheaper tier's highest
effort already falls short; (5) repeating the identical (model, effort) configuration repeats that
configuration's own blind spots — 3 Haiku passes run at 3 DIFFERENT effort levels covered a hard case that
3 identical Haiku-low passes would not have.

**Apply next time:** don't size a subagent by a fixed mental ladder ("Opus > Sonnet > Haiku, always").
For a documented/spec'd task, default to the cheapest tier — it will likely saturate. For unguided review
or judgment work, measure rather than assume: a cheaper model at higher effort can rival a pricier one at
low effort, and the pricier model's own highest effort setting is not always worth its cost over its own
lower effort. Never reach for the most expensive (Fable-class) tier automatically (DR-111 already
requires this) — and when you do reach for it, use its higher effort, not its low effort, for anything
genuinely hard. When one (model, effort) pass is uncertain, vary EFFORT across repeated passes rather than
repeating the identical configuration, if escalating MODEL isn't yet justified.
