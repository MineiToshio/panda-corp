---
id: LESSON-0714
type: anti-pattern
domain: pipeline-design
tags: [ingestion, process-debt, speed, batch-pipeline]
context: an iterative data/batch pipeline (ingestion, migration, backfill) that has grown seals, journals, receipts, content-addressed storage, rebind steps, multiple modes and a suspension grammar reactively, one defensive layer per past failure
trigger: use this when a batch/ingestion pipeline's own operational machinery (state tracking, approval gates, recovery mechanisms) has grown so large that a run now takes days instead of its original target of 1-2 hours
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-21 (owner-stated): 'La maquinaria de proceso de ingesta (sellos, journals, receipts, CAS, rebind, modos, gramática de suspensión, universe) se acumuló para tapar fallos y es la causa de que las ingestas tarden días; la meta es 1-2 h, y una protección que choca con la velocidad sin proteger producción se elimina. Una ingesta no cambia código: bugs → tarjeta borrador y seguir.'"
provenance: owner-stated
created: 2026-11-22
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** a batch/ingestion pipeline accreted one new defensive mechanism (a seal/stamp, a journal, a
receipt, content-addressed storage, a rebind step, a run mode, a suspension grammar) each time a past
failure needed a guard against recurring — none individually unreasonable, but their sum turned a
1-2 hour target run into a multi-day one.

**Lesson:** process machinery built reactively, one layer per incident, optimizes for "never repeat THAT
specific failure" rather than for the pipeline's actual goal (a fast, safe run); it accumulates until its
own overhead dominates wall-clock, at which point the pipeline spends more effort defending against
failures than doing its job. A protection whose cost trades away speed WITHOUT protecting anything that
actually matters (e.g. production state, when the pipeline itself never writes production code) is a
candidate for removal, not for further hardening.

**Apply next time:** (1) set an explicit speed target for the pipeline (e.g. 1-2h) and treat any
accumulated mechanism that makes a normal run miss it as a signal to prune, not to patch further;
(2) separate "protects production/durable state" (keep, harden) from "protects against a past one-off
failure that doesn't threaten production" (candidate to remove); (3) a non-code-mutating pipeline run that
surfaces a CODE bug should not block waiting for that bug to be fixed inline — file it as a draft
backlog/change card and continue the run past it, the same way an ordinary build parks an unrelated doubt
rather than stopping (DR-151).
