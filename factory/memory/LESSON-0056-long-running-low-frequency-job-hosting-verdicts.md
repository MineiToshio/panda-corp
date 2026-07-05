---
id: LESSON-0056
type: library-verdict
domain: serverless-infra
tags: [cloud-run, lambda, fargate, vps, long-running-jobs, serverless-limits]
context: choosing a hosting platform for a low-frequency (1-2 runs/day) long-running job that exceeds typical serverless timeout caps
trigger: use this when a blueprint needs to run a low-frequency, long-running job (minutes, not seconds — e.g. large file transfer/processing) that overflows a typical serverless function's timeout
source: "panda-corp research 2026-07-04, /pandacorp:explore — TikTok cross-poster infra research, official GCP/AWS/Hetzner docs"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0054]
---

**Situation:** a low-frequency (1-2/day) job that downloads/uploads a large file (250MB-1GB across
multiple network legs) overflows Vercel's 300s cap and needs a different execution home.

**Lesson:** for this shape of workload — **Google Cloud Run JOBS** (not Services) is the best fit: task
timeout is configurable up to 168h (the widely-cited 60min cap only applies to Cloud Run SERVICES, not
Jobs), it scales to zero, and it is genuinely free at this volume under the Always Free tier (180k
vCPU-seconds + 360k GiB-seconds/month), with low setup effort. **AWS Lambda is DISQUALIFIED** for this
shape — its hard 900s/15min cap leaves zero margin for a ~1GB file moving across multiple legs. **AWS
Fargate works** (no timeout ceiling, ~$0.10/month at this volume) but has the highest setup cost (VPC,
cluster, task-definition). A **~€4/month Hetzner CX22 VPS** is the "boring-correct" always-on alternative:
one box runs UI+worker+poller-cron with zero timeout and the simplest mental model, at the cost of being a
real subscription that you patch yourself. Chunked-resumable-upload-across-stateless-invocations (HTTP
Range + R2 multipart + a resumable upload session, all of which CAN survive across serverless
invocations) is technically possible but is a maintenance trap at low volume — it means owning your own
state machine, idempotency, and an orphaned-multipart reaper — only justified at high volume/parallelism.

**Apply next time:** when a blueprint's job shape is low-frequency + long-running + moderate data volume,
default to Cloud Run Jobs (or the owner's stated VPS preference if simplicity outweighs the marginal free-
tier savings); rule out Lambda outright for anything that could exceed 900s; only reach for
chunked-resumable-across-invocations complexity once volume/parallelism actually justifies the maintenance
cost.
