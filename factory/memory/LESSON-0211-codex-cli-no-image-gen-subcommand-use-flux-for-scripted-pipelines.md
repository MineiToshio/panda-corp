---
id: LESSON-0211
type: library-verdict
domain: image-generation
tags: [codex-cli, image-gen, scriptable, flux, bfl, seed]
context: choosing an image-generation path for a scripted/automated content pipeline (e.g. a blog-post-image generator) rather than an interactive session
trigger: use this when a pipeline needs scriptable, seed-controllable image generation and codex CLI is under consideration
source: "personal-page-v2 scratchpad research (blog-generator v2 spike), .pandacorp/run/lessons.md 2026-09-07, agent-inferred, tested against codex CLI v0.144"
provenance: agent-inferred
created: 2026-09-08
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: []
---

**Situation:** codex CLI v0.144 has no image-generation subcommand — its `-i` flag is for image INPUT, not
output. An in-session `image_gen` tool does exist on the ChatGPT ("Plus"-style) ChatGPT plan without
needing a separate API key, but it writes files to `~/.codex/generated_images/` as a side effect of an
interactive session and is not reliably scriptable/automatable for a pipeline.

**Lesson:** codex CLI's image capability is interactive-session-only, not a CLI subcommand — a scripted
pipeline that needs to generate images programmatically (with seed control, batch runs, no human in the
loop) cannot rely on it despite the CLI having image-adjacent flags. For that need, an external provider
API is the correct fit; BFL's FLUX Kontext (~$0.04/image at time of evaluation) was verdict-tested as a
viable option for pipelines needing seed control.

**Apply next time:** when a pipeline needs unattended, scriptable image generation, do not assume codex
CLI's `-i` flag or its in-session `image_gen` tool covers that need — verify current codex CLI docs first
(this could change in later versions), and default to a dedicated image-generation API (e.g. BFL FLUX
Kontext) for anything that must run outside an interactive session.
