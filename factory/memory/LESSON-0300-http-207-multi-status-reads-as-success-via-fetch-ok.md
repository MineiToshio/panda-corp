---
id: LESSON-0300
type: gotcha
domain: api-integration
tags: [http, fetch, multi-status, 207, error-handling, zernio, third-party-api]
context: calling a third-party HTTP API that can return 207 Multi-Status (or any 2xx) on a partial failure, when the caller uses the browser/Node `fetch` API
trigger: "use this when integrating any third-party HTTP API whose docs mention per-item/batch results in one response (multi-item posts, batch uploads, bulk operations) — don't trust `fetch(...).ok` alone to mean the whole request succeeded"
source: "pandacast .pandacorp/run/lessons.md inbox note, 2026-10-10, architecture stack-proposal research — Zernio's `POST /v1/posts` (used for the YouTube URL-pull leg, per docs/decision-log.md 2026-10-10 and ADR-0001) accepts `mediaItems[].url` and returns HTTP 207 on partial failure"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** researching Zernio's `POST /v1/posts` endpoint (accepts a hosted media URL, fetches the
file itself — a URL-pull API) found that it returns **HTTP 207 Multi-Status** when some but not all
items in a batched/multi-target post fail. `Response.ok` in the `fetch` API is `true` for ANY status in
the 200-299 range, including 207 — so a caller that only checks `response.ok` reads a partial failure as
a clean success.

**Lesson:** `fetch(...).ok` (or equivalently "status in 2xx") is not a reliable success signal for any API
that can multiplex several outcomes into one response — 207 Multi-Status is the standard HTTP code for
exactly this (per-item success/failure in a batch), but nothing stops a vendor from using a plain 200 the
same way. The generalizable trap is: **a 2xx status code is necessary but not sufficient for "the whole
request succeeded"** whenever the endpoint's own docs describe multi-item/batch/multi-destination
semantics in one call.

**Apply next time:** for any third-party API whose docs mention batching, multiple media items, or
per-target results in a single call, parse the response body's own per-item status fields explicitly
(don't rely on the HTTP status or `fetch().ok` alone) — check the body for a mix of success/failure
entries even when the top-level status is 2xx, and surface/retry the failed items individually.
