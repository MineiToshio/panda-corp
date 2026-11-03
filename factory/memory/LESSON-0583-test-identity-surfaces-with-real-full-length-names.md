---
id: LESSON-0583
type: pattern
domain: testing
tags: [fixtures, identity, display-name, truncation, real-data, owner-stated]
context: testing or reviewing any UI surface that renders a name/identity string (project name, user name, org name) sourced from real data, using only short synthetic fixture names
trigger: use this when writing or reviewing tests/fixtures for any surface that displays a real name/identity string — project title, sidebar label, header, card initials
source: "mission-control .pandacorp/run/lessons.md 2026-10-31 (owner-stated) — independent review reproduced real defects (truncation, wrong initials, overflow) only by testing with the REAL, full project name (e.g. 'Pandacorp (Mission Control)') instead of a short fixture like 'Test'; fixture-only verification had missed them entirely"
provenance: owner-stated
created: 2026-11-01
status: active   # owner-stated; eval-gate (DR-047) qualifies it for immediate activation
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: []
---

**Situation:** a review pass that used only short, convenient fixture names ("Test", "Project A") for
identity-rendering surfaces (sidebar labels, card initials, display-name helpers) had missed real defects
that only manifested with actual production-length names — one real project's display name included a
parenthetical qualifier long enough to overflow a fixed-width container and break initials-derivation
logic that assumed a short, simple string.

**Lesson:** a short, clean fixture name is the EASY case for any identity-rendering code path — it never
exercises truncation, overflow, multi-word initials derivation, or wrapping. Real names are longer,
messier, and more varied than whatever a test author invents for convenience, so a synthetic-fixture-only
suite systematically passes on exactly the inputs least likely to break anything.

**Apply next time:** whenever a UI surface renders a name/identity string sourced from real data (not a
value the user freely controls at test time), include at least one test/fixture using the REAL, full
name as it actually appears in production data — not a shortened stand-in — specifically to catch
truncation, overflow, and derived-label (initials, slug) bugs that only show up at realistic length.
