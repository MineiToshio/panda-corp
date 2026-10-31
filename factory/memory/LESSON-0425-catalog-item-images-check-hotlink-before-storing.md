---
id: LESSON-0425
type: pattern
domain: image-sourcing
tags: [image-sourcing, hotlinking, licensing, collectibles, catalog-apps]
context: sourcing a per-item photo for a catalog/collectible-tracking app (funko-tracker) where downloading and storing the image is the default instinct
trigger: use this when a catalog/collectible-tracking app needs a photo per item and the default instinct is to download and store the image yourself
source: "funko-tracker .pandacorp/run/lessons.md 2026-10-17 — verdict (agent-inferred): funko.com product images (funko.com/dw/image/v2/..., Cloudflare-backed) are hotlinkable (200 status to any foreign origin, no CORP header, 30-day cache, a `?sw=` resize query param); the product PAGES themselves 403 script fetches, so they must be read via a browser instead; kinder.com campaign images are hotlinkable too; hotlinking grants no license (Funko ToS: personal, non-commercial use only). pattern (owner-stated): the owner prefers reusing official image URLs (hotlink, or a same-origin proxy, as done in a prior project's Character Dex) over storing photos."
provenance: owner-stated
created: 2026-10-18
status: active
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0343, LESSON-0350, LESSON-0304, LESSON-0329]
---

**Situation:** funko-tracker needed a photo per catalog item (licensed collectibles). The default
instinct was to download and store each image. Checking first showed the brand's own CDN
(`funko.com/dw/image/v2/...`, Cloudflare-backed) serves images hotlinkable — 200 status to any foreign
origin, no `Cross-Origin-Resource-Policy` block, a 30-day cache header, and a `?sw=` resize parameter —
while the product PAGES themselves 403 any script fetch (readable only via a real browser). A sibling
site (kinder.com) behaved the same way for its campaign images.

**Lesson:** for a catalog/collectible app, test whether the brand's own CDN serves images hotlinkable
(foreign-origin 200, no CORP block, cacheable) BEFORE building a download/storage pipeline — many brand
CDNs are built exactly this way. This owner specifically prefers reusing the official URL (hotlink, or a
same-origin proxy as done previously for a Character Dex feature) over owning a copy of the asset.
Hotlinking is NOT a license grant, though: a "personal, non-commercial use only" ToS restriction still
applies, so record the source URL, a photo credit, and a confidence/licensing tier per item rather than
just the asset — and fall back to a placeholder/silhouette for any item with no hotlinkable official
image (see LESSON-0304/LESSON-0329 for the placeholder itself, LESSON-0343/LESSON-0350 for the licensing
boundary this still sits inside).

**Apply next time:** for any catalog/collectible-tracking app needing item photography, test
hotlink-ability of the brand's own CDN first (a request with a foreign `Origin`/`Referer`, checking
status + `Cross-Origin-Resource-Policy` + cache headers) before writing a scraper or storage pipeline;
store the source URL + credit + licensing tier per item, never just the downloaded asset; treat anything
beyond personal/non-commercial display as an owner-gated decision.

**Quantified facet (funko-tracker, 2026-10-30, agent-inferred):** when an item's hotlinked image is
flagged as too small, retry the SAME `funko.com` URL with a larger value in its `?sw=`-style size
parameter before reaching for any AI upscale — in this project's run, 31 of 34 size-flagged items were
cleared this way with zero AI involved. Treat "request a larger size via the CDN's own resize param" as
the first fallback for an undersized hotlinked image, not AI upscaling, which should be reserved for the
items the size-param retry genuinely cannot clear.
