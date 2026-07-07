---
id: LESSON-0101
type: pattern
domain: single-source-of-truth
tags: [ssot, materialized-cache, staleness, seal, freshness, dr-115]
context: reviewing or designing a materialized/cached read-model that embeds cross-unit (factory-wide/aggregate) facts inside a per-unit (per-project) artifact, freshness-guarded by a per-unit seal
trigger: use this when reviewing a materialized read-model (a cache with a staleness seal/hash) that combines data scoped to ONE unit with data that depends on OTHER units
source: "mission-control .pandacorp/run/lessons.md 2026-07-07 (FRD-23 SSOT split, DR-115) — agent-inferred; the resulting cross-project staleness bug was fixed via an SSOT split (WO-23-005/006) the same build. Corroborated same day by a SECOND, distinct failure mode in the same per-project portada seal: it covers neither a computed scalar (`scalars.commits`, derived live via `git rev-list --count HEAD`, not backed by any watched file path) nor gitignored inputs (`funnel.ideasCaptured` ← `factory/ideas/`, invisible to a git-diff-based seal) — drift proven on real data (aggregate `commits=1096` vs live `1101` under the SAME 'fresh' seal). Routed to `/pandacorp:change` (mission-control's own queue) for the fix; only the generalized lesson lands here."
provenance: agent-inferred
created: 2026-07-07
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [DR-115, DR-078]
---

**Situation:** a per-project read-model embedded factory-wide facts (e.g. cross-project phase transitions,
aggregate scalars) inside a materialized artifact sealed for freshness by a PER-PROJECT hash/seal. That
seal only watches the paths of the project it belongs to — it has no way to detect that a DIFFERENT
project's state changed, so a phase change elsewhere left the embedded factory-wide facts stale while the
per-project seal still reported "fresh." The fix was to SPLIT the read-model: per-project facts stay
sealed per-project; factory-wide facts move to their OWN store with their OWN seal, each independently
falling back to a live-derive path when stale (never fabricating a value, DR-078).

**Lesson:** a freshness seal is only as good as its scope. When reviewing (or designing) a materialized
read-model, check explicitly whether every fact it embeds is covered by the SAME scope its seal watches —
a seal scoped to unit A cannot validate freshness for a fact that depends on unit B, C, ... N. If a design
mixes scopes without matching seal granularity to fact granularity, it is a latent SSOT bug, not a
performance detail.

**Apply next time:** when a materialized cache combines "this unit's own facts" with "facts that depend on
other units," give each scope its OWN seal (or split them into separate stores/artifacts entirely) rather
than sharing one seal across scopes. If the mismatch is already baked into an approved FRD/ADR contract
(not something the builder introduced), that is an owner decision to log and fix at the design level — not
something a gate/test can patch around.

**"Every dependency" is broader than cross-unit scope.** A second instance of this same lesson (same day,
same class of seal) showed the gap is not limited to "another unit's data" — a seal can just as easily miss
(a) a COMPUTED/derived scalar that isn't backed by any watched file path at all (e.g. a live `git
rev-list --count` value folded into the cache but never enumerated as a seal dependency), and (b)
GITIGNORED inputs, which a git-diff-based seal cannot see change because they have no tracked history to
diff. When auditing a seal's dependency list, enumerate not just "which OTHER units" but "which computed
values" and "which gitignored paths" feed the cache — both are easy to leave out because neither shows up
in a straightforward "which tracked files does this read" scan.
