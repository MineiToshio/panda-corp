---
id: LESSON-0301
type: library-verdict
domain: social-media-apis
tags: [tiktok, yt-dlp, curl-cffi, display-api, video-listing, scraping]
context: choosing how to LIST (not download) a TikTok account's videos for an automated tool
trigger: "use this when a tool needs to enumerate/list a TikTok account's videos (not just download one known video) — prefer the official Display API over yt-dlp's user-listing extractor"
source: "pandacast .pandacorp/run/lessons.md inbox note (2026-10-10) + docs/adr/0003-tiktok-source-and-feasibility-spike.md (ACCEPTED-pending-spike, 2026-10-10) — yt-dlp's `tiktok:user`/`tiktokuser:<secUid>` extractor is flaky in production (yt-dlp issue #17500, open, ~1/3 hourly runs failing across ~23 accounts) while single-video download works IF `curl_cffi` browser impersonation is installed; the project chose TikTok Display API `video.list` (own developer app, Sandbox mode) as primary listing, with yt-dlp user-listing only as a documented fallback"
provenance: agent-inferred
created: 2026-10-13
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0051, LESSON-0053]
---

**Situation:** a tool needs to enumerate a TikTok account's videos (for re-processing/cross-posting).
yt-dlp's user-listing extractor (`tiktok:user` / `tiktokuser:<secUid>`) looked like the obvious
zero-setup choice, but it is documented as flaky in production (upstream issue #17500, open at time of
writing, ~1/3 of hourly listing runs failing across a sample of ~23 accounts) — a materially different
reliability profile than yt-dlp's SINGLE-VIDEO download, which works reliably once `curl_cffi` browser
impersonation is installed (without it, TikTok returns "Unexpected response").

**Lesson:** yt-dlp's reliability for TikTok is NOT uniform across operations — single-video download
(with `curl_cffi` impersonation) is comparatively stable; user/account-level LISTING is the flaky leg.
The official TikTok Display API's `video.list` endpoint (via the owner's own developer app, usable in
Sandbox mode without a full app review, scoped to the owner as target user) is the more reliable choice
for listing, even though it needs an OAuth app + token refresh (access token 24h, refresh token 365
days) instead of zero-setup scraping.

**Apply next time:** when a tool needs to LIST a TikTok account's videos, split the decision from
DOWNLOADING a video: reach for the TikTok Display API (`video.list`, Sandbox mode, your own developer
app) for listing — accept the OAuth/token-refresh setup cost for the reliability gain; reserve yt-dlp
for single-video download by known URL (with `curl_cffi` impersonation installed, and the extractor
pinned + expected to need a bump every month or two as TikTok changes its page). Treat yt-dlp
user-listing as a documented fallback only, not the primary path.
