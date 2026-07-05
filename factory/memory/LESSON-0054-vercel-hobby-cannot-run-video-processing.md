---
id: LESSON-0054
type: gotcha
domain: serverless-infra
tags: [vercel, hobby-tier, video-processing, serverless-limits]
context: choosing Vercel as the compute layer for a pipeline that downloads/uploads large video files
trigger: use this when a blueprint proposes running heavy file/video-processing legs (large downloads, uploads, transcoding) on Vercel's free Hobby tier
source: "panda-corp research 2026-07-04, /pandacorp:explore — TikTok cross-poster infra research, official Vercel docs"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0055, LESSON-0056]
---

**Situation:** the factory's default deploy target is Vercel (owner preference). A design considered
running the whole cross-poster pipeline — including downloading/uploading 250MB-1GB video files — as
Vercel serverless functions.

**Lesson:** Vercel Hobby (free tier) cannot run a heavy video-processing leg: a hard 300s function
timeout (NOT extendable on Hobby — the 2025 Fluid-compute default), a fixed 2GB memory ceiling, a 4.5MB
request/response body limit (so files cannot transit a function's proxied body at all — only an outbound
`fetch()`-streaming pattern avoids this limit, and even that is bounded by the 300s+2GB caps), and a
10GB/month "Fast Origin Transfer" fair-use allowance that daily 300MB-1GB transfers blow past quickly.
Hobby is also contractually non-commercial, separate from the technical caps.

**Apply next time:** when a blueprint's data-heavy leg (video/large-file download+upload, transcoding)
would exceed Vercel Hobby's 300s/2GB/4.5MB-body/10GB-month limits, keep Vercel for the UI/control-plane
only and route the byte-heavy work to a long-running worker (a container platform like Fly.io, Cloud Run
Jobs, or a small always-on VPS) — do not assume "we deploy on Vercel" covers the whole pipeline by default.
