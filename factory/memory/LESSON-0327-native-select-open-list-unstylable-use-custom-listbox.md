---
id: LESSON-0327
type: pattern
domain: web-components
tags: [select, native-html, listbox, design-fidelity, cross-browser]
context: deciding whether a dropdown/select control in a visually-designed app can use the native HTML `<select>` element
trigger: use this when a designed app needs a dropdown/select control and reaching for the native HTML `<select>` element seems like the simplest option
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 harvest (owner-stated): the owner's standing rule is to never ship native `<select>` option lists in a designed app — the closed control can be restyled with CSS, but its OPEN option-list popup is rendered by the OS/browser and cannot be styled to match the app's design"
provenance: owner-stated
created: 2026-10-15
status: active
promotion: proposed   # 2026-10-17 (librarian review) — target: factory/standards/design.md (add "never ship a native `<select>` as the dropdown in a designed app" as a standing rule, pointing to a custom-listbox pattern). Corroborated across 2 distinct projects (funko-tracker, pandasaga), both owner-stated as a standing personal rule — high confidence, zero contradicting evidence.
confidence: high
times_applied: 2
applied_in: [funko-tracker, pandasaga]
links: [LESSON-0322]
---

**Situation:** a native HTML `<select>` element was considered for a dropdown control in a visually
designed app. Its closed/collapsed state can be styled to match the design system, but opening it
reveals an OS/browser-rendered option list that ignores the app's styling entirely and looks visually
disconnected from the rest of the UI.

**Lesson:** `<select>`'s closed control and its open option-list popup are two different rendering
surfaces with very different styling reach: the closed control is a normal styleable element, but the
open list is drawn by the OS/browser chrome and is NOT reliably stylable across browsers (fonts,
colors, spacing, hover states). An app can look fully on-brand until the moment a user opens any
select, at which point the illusion breaks.

**Apply next time:** never ship a native `<select>` as the dropdown control in a designed app; build
(or adopt) a custom listbox/combobox component (button trigger + a fully-styled, keyboard-accessible
popup list) whenever the open list's appearance needs to match the design.
