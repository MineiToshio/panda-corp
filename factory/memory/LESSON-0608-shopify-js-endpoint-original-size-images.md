---
id: LESSON-0608
type: gotcha
domain: content-sourcing
tags: [shopify, scraping, image-sourcing, rate-limiting, catalog-apps]
context: sourcing original-size product images from a Shopify-powered storefront when the store's own HTML/search pages are rate-limited for a plain `curl`/fetch
trigger: use this when a target storefront runs on Shopify and direct HTML page fetches for a product are rate-limited or otherwise unreliable
source: "funko-tracker .pandacorp/run/lessons.md 2026-11-03 (agent-inferred): mypops.ca (Shopify) exposes /products/<handle>.js with original-size images, useful when the store's HTML search is rate-limited for curl"
provenance: agent-inferred
created: 2026-11-04
status: candidate
promotion: none
confidence: medium
times_applied: 0
applied_in: []
links: [LESSON-0425]
---

**Situation:** needed original-size product images from a Shopify storefront; the store's HTML
search/product pages were rate-limited for a plain script fetch.

**Lesson:** any Shopify storefront exposes a stable, undocumented-but-standard JSON endpoint at
`/products/<handle>.js` (the product handle from its normal URL) that returns the product's full data,
including original-size image URLs — this endpoint is a Shopify platform convention, not specific to one
store, and it is lighter-weight than the HTML page, so it is less likely to be rate-limited.

**Apply next time:** when sourcing images/data from a storefront and it turns out to run on Shopify
(check for `/products/<handle>.js` or standard Shopify asset paths), try the `.js` product endpoint before
building a heavier HTML scraper or giving up on a rate-limited page fetch.
