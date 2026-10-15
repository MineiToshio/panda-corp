---
id: LESSON-0337
type: pattern
domain: image-generation
tags: [codex-cli, parallelism, xargs, reference-images, batch]
context: generating a batch of many images (character portraits, scenes, emblems) via the Codex CLI's image generation where visual consistency across a cast matters
trigger: use this when a build needs more than a handful of AI-generated images and some of them must stay visually consistent with each other (a recurring cast, a shared style)
source: "pandasaga .pandacorp/run/lessons.md 2026-10-14 (agent-inferred): `xargs -P 4` over a jobs file with a per-job retry loop produced 17/17 images in about 35 minutes; passing reference portraits with `-i` kept a cast visually consistent"
provenance: agent-inferred
created: 2026-10-15
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0325]
---

**Situation:** a build needed 17 AI-generated images (portraits, emblems, scene art) from the Codex CLI,
several of which needed to look like the same consistent cast rather than independently-styled one-offs,
and sequential generation would have been too slow.

**Lesson:** a simple jobs-file + `xargs -P <n>` fan-out, with a per-job retry loop (Codex image
generation can return transient errors, see LESSON-0325), reliably produces a full batch (17/17 in
about 35 minutes at `-P 4`) without needing a bespoke orchestration script. Separately, passing already-
generated reference portraits to later generation calls via `-i` (image-input) is what actually keeps a
recurring cast visually consistent across calls — it is not something that happens automatically from a
shared text prompt/style description alone.

**Apply next time:** for a batch of AI image-generation calls, write one line per job to a plain jobs
file and fan out with `xargs -P <n> <generate-one.sh>` wrapping each call in its own retry loop; for any
subset that must look like the same character/cast across multiple images, generate the first
reference image(s) first and pass them as `-i` input to every subsequent call for that character, rather
than relying on prompt text alone for consistency.
