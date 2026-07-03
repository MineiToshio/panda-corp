---
id: LESSON-0025
type: gotcha
domain: browser-extensions
tags: [browser-extension, manifest-v3, platform-risk, discovery]
context: evaluating a browser-extension idea that integrates with a third-party web platform
trigger: use this when scoping or researching a browser-extension idea that reads/modifies a specific third-party site
context2: null
source: "panda-corp research 2026-07-01"
provenance: agent-inferred
created: 2026-07-03
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** a browser-extension idea's viability depends heavily on whether its target platform
tolerates third-party extensions or actively fights them (ToS bans, API caps, Manifest V3 limits).

**Lesson:** as of 2026-07-01, hostile platforms (real account-ban / API-kill risk): WhatsApp Web and
LinkedIn (both ban the USER'S account, not just the extension, for automation-like behavior), Spotify
(API endpoints capped since Nov 2024). Tolerant platforms: YouTube (UX-mod extensions, though ad-block
specifically is fought), Steam, Gmail/Google Calendar, Twitch. Separately, Manifest V3 (now mandatory)
kills network-level blocking (`webRequest` blocking) but does NOT restrict content-script UI
modification — an idea that only touches the DOM/UI is unaffected by MV3; one that needs to intercept
network requests is not viable the old way.

**Apply next time:** before scoping a browser-extension idea, check the target platform against this
list and check whether the idea needs network-level blocking (MV3-dead) vs DOM/UI modification
(MV3-fine); an idea targeting WhatsApp/LinkedIn/Spotify-API carries real user-account-ban risk that
should be flagged to the owner before building.
