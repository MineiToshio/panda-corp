---
id: LESSON-0199
type: gotcha
domain: agent-tooling
tags: [claude-in-chrome, browser-profile, extension, identity-verification]
context: using the Claude in Chrome browser extension to navigate to a service requiring a logged-in session (PostHog, Vercel, GitHub, etc.)
trigger: use this before navigating to any authenticated service via the Claude in Chrome extension, or when `list_connected_browsers`/`switch_browser` doesn't find an expected profile
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-05 (owner-stated)"
provenance: owner-stated
created: 2026-09-07
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** the Claude in Chrome extension connects PER CHROME PROFILE, not per browser install.
`list_connected_browsers` only sees profiles where the extension is installed AND active, and
`switch_browser` finds nothing if the desired profile doesn't have it installed.

**Lesson:** "a browser is connected" is not evidence it's the RIGHT profile/account — there is no
guarantee the only connected browser/profile is the one holding the session you actually need.

**Apply next time:** before navigating to a service with its own login session (PostHog, Vercel, GitHub,
etc.) via Claude in Chrome, confirm with the owner which profile/account is expected, and verify the
logged-in identity on the page itself — never assume the sole connected browser is the correct one.
