---
id: LESSON-0643
type: pattern
domain: image-generation
tags: [ai-generation, chroma-key, background-removal, cutout, halo]
context: generating an AI image of a loose collectible figure against a solid background intended for later cutout/background-removal
trigger: use this when planning the background color for an AI-generated image that will later go through a cutout/background-removal step
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-08 (agent-inferred): loose AI-generated figures rendered on a dark green background left visible green halos around the cutout edge after background removal; switching to a neutral grey (#808080) background avoided the halo; validating the cutout before the first 'produce' matters because a re-cut counts as a new AI generation attempt against any attempt-budget"
provenance: agent-inferred
created: 2026-11-09
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0572, LESSON-0617]
---

**Situation:** an AI image-generation step rendered a loose collectible figure on a dark green background
(a classic chroma-key choice), intending to cut the figure out afterward. The cutout left a visible green
halo/fringe around the figure's edges — the generative model doesn't produce a crisp, uniform chroma
plane the way a real studio chroma backdrop does, so edge pixels blend the figure's own color with the
background color, and standard chroma-key removal can't fully separate them.

**Lesson:** a classic chroma-key color (saturated green/blue) is tuned for REAL photography against a
physically uniform, evenly-lit backdrop — a generative model asked to "paint a green background" does not
reproduce that uniformity, so green/blue-screen assumptions (hue-based keying) fail on AI-generated
output in a way they wouldn't on a real photo. A neutral grey background instead gives the generative
model an easier target to render uniformly, and grey has no hue to bleed into the figure's edge,
sidestepping the halo failure mode entirely.

**Apply next time:** when the next step after AI image generation is a background cutout, request a
neutral grey (around #808080) background from the generator rather than a traditional chroma-key
green/blue — it is more robust to the generator's own uniformity limits. Validate the resulting cutout
(no halo/fringe) BEFORE treating the image as the accepted "produce" result: if a re-cut or re-render is
needed, that consumes another attempt against whatever attempt budget/counter governs the item, so
catching a bad cutout early avoids silently burning attempts on a background-color mistake rather than a
genuine content problem.
