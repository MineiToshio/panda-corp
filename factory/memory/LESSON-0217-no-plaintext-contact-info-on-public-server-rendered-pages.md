---
id: LESSON-0217
type: pattern
domain: privacy
tags: [privacy, contact-info, server-rendered-html, spam, portfolio]
context: deciding how to expose a personal email or phone number on a public-facing, server-rendered site
trigger: use this when a public site's contact/footer section needs to surface a personal email or phone number
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-08, owner-stated — a personal phone number placed in plain text on a public landing page (a prior, unrelated project) drew persistent call spam; the owner applies this as a hard rule to any personal contact info on any public site being built"
provenance: owner-stated
created: 2026-09-10
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0042]
---

**Situation:** a personal email/phone number placed as plain text in the server-rendered HTML of a public
page is fully scrapable by automated harvesters the moment the page is indexed or crawled — a concrete,
real-world instance of this cost persistent, unwanted spam calls on a past, unrelated project.

**Lesson:** plain-text contact info in server-rendered HTML on any public site is a standing scraping
target, regardless of how obscure the page seems — the exposure is passive and permanent (it survives as
long as the page is indexed), not a one-time risk. This is the same privacy-by-default posture LESSON-0042
already applies to case-study screenshots, generalized to the contact surface itself.

**Apply next time:** never render a personal email or phone number as plain text in a public site's
server-rendered HTML. Prefer a contact FORM (server-side submit, no client-visible address) or a
redirect/mailto obfuscation pattern instead; if a phone/email must appear as visible text at all, keep it
off server-rendered markup (client-rendered-only, or behind an explicit reveal interaction) so it is not
present in the crawlable HTML response.
