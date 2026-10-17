---
id: LESSON-0358
type: gotcha
domain: react
tags: [modal, focus-management, a11y, return-focus, shared-component]
context: a shared modal component is reused across several trigger surfaces, and the trigger element that opened it may itself unmount, re-render, or be re-queried while the modal is open
trigger: use this when a shared modal component's focus-management contract needs to restore focus to its opener on close, especially when a trigger can be added, removed, or remounted while the modal is open
source: "factory/memory/_inbox.md agent-inferred notes — Mission Control, 2026-10-16/17: the core Modal focused its own panel on open without restoring the opener on close (live Spec FRD E2E); adding a second fullscreen trigger icon broke a focus-trigger ref fixed to a legacy text control that didn't survive a remounted inline icon"
provenance: agent-inferred
created: 2026-10-17
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0019, LESSON-0045]
---

**Situation:** a shared Modal component is reused by multiple different trigger surfaces across the app
(text buttons, icon buttons). Two distinct bugs surfaced from the same underlying assumption: (1) the modal
focused its own panel on open but never restored focus to whatever opened it on close; (2) once a SECOND
trigger (an icon, alongside the original text trigger) was added, a ref hard-coded to the original text
control stopped working whenever the actual invoking control was the new icon, or when that icon's own
instance remounted.

**Lesson:** "reusing a shared modal component" does not automatically mean return-focus behavior works —
focus-restore needs the modal to actively CAPTURE whichever element was focused immediately before it
opened (not assume a fixed ref to one known trigger), and to verify that element is still mounted/connected
before restoring focus to it. A trigger can be removed, re-rendered, or exist in more than one shape
(text vs. icon) by the time the modal closes.

**Apply next time:** have the modal capture `document.activeElement` (or an explicit opener reference passed
at open time) at the moment it opens, and on close restore focus to it ONLY while it is still connected to
the DOM — falling back to a sane default (e.g. the nearest stable ancestor) otherwise. Test both a
conditional-unmount case (the opener disappears while the modal is open) and a multi-trigger case (more than
one control can open the same modal, and a newly-added trigger must re-query itself rather than reuse a
stale ref to a different trigger).
