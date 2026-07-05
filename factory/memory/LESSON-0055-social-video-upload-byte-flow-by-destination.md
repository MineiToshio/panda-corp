---
id: LESSON-0055
type: gotcha
domain: serverless-infra
tags: [instagram, youtube, facebook, cloudflare-r2, video-upload, bandwidth]
context: architecting the upload leg of a tool that publishes video to Instagram, Facebook and YouTube via their official APIs
trigger: use this when designing the byte-transfer path for a tool that publishes video to Instagram, Facebook, and/or YouTube via official APIs
source: "panda-corp research 2026-07-04, /pandacorp:explore — TikTok cross-poster infra research, official Meta/YouTube/Cloudflare docs"
provenance: agent-inferred
created: 2026-07-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0054, LESSON-0056]
---

**Situation:** designing the upload leg of a cross-poster that publishes the same source video to
Instagram, Facebook, and YouTube — deciding whether the compute layer must proxy the video bytes itself
for each destination.

**Lesson:** the byte-flow is SPLIT by destination, not uniform: Instagram's Content Publishing API is
URL-pull (`video_url` — Meta's servers `cURL` the video directly from a hosted URL, so if the source is a
Cloudflare R2 public/signed URL, this leg costs zero compute bandwidth and R2 egress is free). Facebook's
Page `/videos` endpoint ALSO accepts `file_url` (confirmed in the Graph API reference: "cannot be used
with `upload_phase`") — Meta pulls from the hosted URL for Facebook too, not just Instagram/Stories.
YouTube's `videos.insert`, by contrast, is byte-upload only (resumable chunked upload, no URL-fetch
option) — there is no way to make YouTube pull from a URL. Cloudflare R2's free tier trivially handles
250MB-1GB ephemeral temp objects (10GB storage, $0 egress, multipart-resumable up to ~5GiB/part), making
it a good staging point regardless.

**Apply next time:** when scoping the compute/bandwidth budget for a multi-destination video publisher,
check each target platform's API docs for URL-pull vs byte-upload BEFORE assuming all destinations need
your worker to proxy bytes — Meta (Instagram AND Facebook) offloads the transfer if you stage the file at
a public/signed URL (e.g. R2); only YouTube (and, in this research, TikTok's own upload) genuinely need to
push bytes through your compute, which shrinks the worker's real heavy-lifting surface to those legs only.
