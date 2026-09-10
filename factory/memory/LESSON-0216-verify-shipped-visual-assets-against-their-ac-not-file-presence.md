---
id: LESSON-0216
type: pattern
domain: agent-verification
tags: [acceptance-criteria, assets, favicon, visual-verification, ac-fidelity]
context: an acceptance criterion describes a specific branded/visual asset (a favicon, a logo file, an icon set) and the corresponding file exists on disk
trigger: use this when closing out an AC that describes a specific visual/branded asset and the file it points to already exists — before declaring the AC satisfied
source: "personal-page-v2 .pandacorp/run/lessons.md 2026-09-08, owner-stated — FRD-01 AC-01-005.2 required the brand favicon; the shipped file was a generic placeholder (a black circle with a white triangle) unrelated to the real logo, undetected until the owner looked at the browser tab"
provenance: owner-stated
created: 2026-09-10
status: active
promotion: none
confidence: high
times_applied: 0
applied_in: []
links: [LESSON-0069]
---

**Situation:** an FRD's acceptance criterion required the site's real brand favicon. The shipped file
existed at the expected path and passed every automated check that only verifies a file is present at
that path — but its actual content was a generic placeholder icon with no relation to the real logo. No
one noticed until the owner personally looked at the browser tab, well after the work order had closed as
done.

**Lesson:** "the file exists at the AC-required path" is not the same claim as "the file's content
satisfies what the AC describes" — for any AC describing a specific VISUAL asset (branding, icons, images
with a required subject), file presence is a necessary but not sufficient check. This is a visual-asset
instance of the broader "verify against the live artifact, not a stand-in" family (LESSON-0069): here the
stand-in is "a file exists at this path," and the live artifact is what that file actually shows when
rendered/opened.

**Apply next time:** when closing out an AC that describes a specific visual/branded asset, open or render
the actual file (not just confirm its existence) and compare it against what the AC describes before
declaring the criterion satisfied — a quick visual check (open the icon, render the favicon in a browser
tab) costs seconds and catches exactly this class of silent gap that automated presence-only checks miss.
