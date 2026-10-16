# Brand identity and logo (Step 2b)

The design phase owns the product's mark. A product reaching architecture with no logo forces an improvised one in the build, which is never what the owner would have chosen.

## 1. Principles before pictures

- Read the PRD's **future scope**, not only v1. If the product will cover more media, audiences or platforms later, the brand must not depend on today's one (PandaSaga: the first logos were all books; the owner rejected them because the product will cover manga, series, games and podcasts).
- Write 3 to 5 brand principles in `docs/design/brand.md` (what the mark must express, what it must never depict, the size it must survive: a 16 to 32 px app icon).
- Brief the owner in Spanish with the principles before generating; it saves a whole round.

## 2. Concepts with Codex image generation

Generate 4 to 6 genuinely different concepts in parallel with `scripts/codex-image.sh` (Codex's built-in image tool; default model `gpt-5.6-sol`, override with `CODEX_IMAGE_MODEL`):

```bash
# one <name>.prompt per concept, plus jobs.txt with one "<name>|" line each
cat jobs.txt | xargs -P 5 -I{} zsh "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/codex-image.sh" "$WORKDIR" "{}"
```

Prompt template (one concept per prompt; keep every constraint, they are what makes the result usable):

> Use your built-in image generation tool to create ONE new image and save it as ./<name>.png in the current directory. Do not create, modify or delete any other file. Concept: <one concrete idea and its meaning>. Constraints: an original brand symbol for <Product>, <one-line purpose>, so the symbol must NOT depict <the forbidden literal objects>. Flat vector-style shapes, clean geometry, generous negative space, at most two colours (<hex>, <hex>) on a plain solid white background (not transparent), centred with wide margins, square 1:1. Must stay recognisable as a 16 to 32 pixel app icon: few bold shapes, no fine lines, no gradients, no shading, no 3D, no texture, no mockup, no text, letters or words, no watermark, no border. <Tone>; do not imitate any existing logo (<named look-alikes to avoid>). When done, reply with the saved filename only.

Gotchas: Codex may still return transparency (composite onto white before making a JPEG contact sheet); a job can silently produce nothing (the script retries 4 times with backoff); pass the chosen concept back with `-i` (`jobs.txt`: `name|chosen.png`) to explore refinements of one direction.

Show all concepts on one contact sheet with a short verdict each, recommend one, and let the owner choose (it is a human gate).

## 3. Refine the chosen concept as vector, by hand

Never ship the AI raster. Redraw the chosen concept as SVG from named geometry constants (one generator function in the prototype, e.g. `logoSvg({ size, tone, px })`), so every variant comes from the same source:

- **Sizes:** a full mark and a small variant for 32 px and below (thicker strokes, fewer details).
- **Tones:** on light, on dark, tile (app icon/favicon ground), one colour (`currentColor`), and a favicon variant with literal colours (a favicon cannot read CSS variables).
- **Brand tokens** for the mark's colours (`--brand-*`, `--mark-*`) in `design-tokens.json`.
- A **brand page** in the prototype (e.g. `#/brand`): principles, the mark at real sizes on both surfaces, lockups with the wordmark, and don'ts. Apply the mark in the header, footer and favicon.

## 4. Freeze and hand-off

At freeze, export every variant as standalone SVG files (`docs/design/prototype/logo/*.svg`, CSS variables resolved to literal colours) through the `exports` key of `docs/design/freeze/fidelity.config.json`, written by the toolkit's catalog stage (`node "${CLAUDE_PLUGIN_ROOT}/skills/design/scripts/fidelity/freeze.mjs" catalog`, or `all`; see `scripts/fidelity/README.md`). Record in `DESIGN.md` → Logo: sizes, surfaces, lockups, don'ts. Add "trademark check of the name and mark before production" to the release checklist (technical assumptions); it is not a design-phase blocker.
