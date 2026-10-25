---
id: LESSON-0521
type: gotcha
domain: rendering-pipeline
tags: [sandboxed-renderer, modal, asset-pipeline, drift, preview-parity]
context: a server-side/sandboxed rendering image (e.g. a Modal/serverless container) that mirrors a subset of the repo's static assets to produce a pixel-accurate export matching an in-app preview
trigger: use this when a new static asset category is added to an exported/rendered artifact (stickers, icons, a new font) and the export's rendering sandbox has its own fixed list of asset directories it copies in
source: "funko-tracker .pandacorp/run/lessons.md 2026-10 (agent-inferred) — the Modal rendering image's build only copied public/fonts and public/brand; when new export-only assets (variant/retailer stickers) were added under a different public/ subdirectory, the exported PNG silently diverged from the live in-app preview because the sandbox never received the new files"
provenance: agent-inferred
created: 2026-10-25
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0382]
---

**Situation:** an exported artifact (a printable poster/sheet) is rendered inside a sandboxed service
(Modal) that builds its own container image and copies in only the specific asset directories the
renderer was known to need at the time it was built. A later feature added a new category of visual
asset (stickers) under a `public/` subdirectory the sandbox's build script did not know about — the
in-app preview (served from the full app) rendered them correctly, but the exported PNG silently
rendered without them, with no error anywhere in the pipeline.

**Lesson:** a sandboxed renderer that mirrors a HAND-MAINTAINED, fixed list of asset directories is a
second, independent copy of "what assets this feature needs" — exactly the same class of drift as a
gitignored generated client going stale (LESSON-0439), but for static assets instead of a schema. Every
time a feature adds a new asset category reachable from the renderer's output, the sandbox's own asset
manifest/build script needs an equally explicit update, and nothing in the stack fails loud when it is
forgotten — the output just quietly diverges from the preview.

**Apply next time:** when a rendering sandbox mirrors assets via an explicit directory list (rather than
the whole `public/` tree), treat that list as part of the feature contract: any PR/change that adds a new
export-visible asset directory must also update the sandbox's asset manifest in the same change, and the
preview-vs-export parity check (see LESSON-0382-adjacent practice) should specifically probe the new
asset category, not just layout.
