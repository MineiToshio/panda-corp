---
id: LESSON-0547
type: gotcha
domain: infra
tags: [cloudflare, r2, cdn, cache, custom-domain, negative-caching, s3, race-condition]
context: checking whether an object exists in an R2/S3-backed bucket that is ALSO served through a CDN custom domain (e.g. a Cloudflare custom domain in front of an R2 bucket), before or during an upload/publish step
trigger: use this when probing object existence through a public CDN custom domain URL in the same workflow that is about to upload that very object
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-28 (agent-inferred) — probing a not-yet-uploaded R2 object through its public Cloudflare custom domain returned 404 with `cf-cache-status: HIT` for several minutes AFTER the object was successfully uploaded, because the earlier 404 response had been cached at that edge PoP"
provenance: agent-inferred
created: 2026-10-30
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a pipeline checked whether a media object already existed at its public, CDN-fronted
custom-domain URL before uploading it. The object did not exist yet, so the probe correctly got a 404 —
but that 404 response was cached at the edge PoP the probe happened to hit. The object was then
uploaded directly to the bucket (bypassing the CDN). A subsequent check of the SAME public URL kept
returning the cached 404 (`cf-cache-status: HIT`) for several minutes after the upload had already
succeeded, making a perfectly good upload look like it had failed or not landed.

**Lesson:** a CDN sitting in front of an object store caches NEGATIVE responses (404s) the same way it
caches positive ones, keyed by edge PoP — so "does this object exist" and "has my CDN-fronted URL
started serving it" are two different questions with two different, independently-cacheable answers.
Checking existence through the public CDN URL right before/after an upload races the CDN's own cache
TTL and can report "still missing" long after the underlying store already has the object.

**Apply next time:** never use the public CDN/custom-domain URL to check whether an object exists in a
workflow that uploads through a different path (direct S3/R2 API) — check existence directly against
the object store itself (an S3 `HEAD` request on the bucket/key) instead, which is authoritative and
immune to CDN edge-cache staleness. Reserve the public URL check for verifying end-user-visible
availability AFTER a deliberate cache-bust/purge, not for upload-time existence checks.
