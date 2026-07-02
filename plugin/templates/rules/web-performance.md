---
description: Web performance — Core Web Vitals plus runtime/data-fetching patterns (no waterfalls, dedup, no barrel imports).
applies_when: web-ui
globs: ["app/**", "src/**"]
source: Pandacorp standard — performance
---

# Web performance

(Barrel files — the hot-path import tax — are mechanically banned by Biome `noBarrelFile`/`noReExportAll` in the canonical `biome.json`; import from the concrete file. Fix the gate's message, don't argue with it.)

## Core Web Vitals (field p75 targets)
- **LCP ≤ 2.5 s · INP ≤ 200 ms · CLS ≤ 0.1.**
- Images via the framework's `<Image>`, fonts via `next/font` (avoids CLS). Lazy-load the non-critical.
- A JS budget is defined up front; no bundle regressions without justification.

## Data fetching
- **No request waterfalls**: fire independent async work concurrently (`Promise.all`); `await` only where the value is used (defer awaits into the branch that needs them).
- **Deduplicate per request** with `React.cache()` (or the framework's request cache) so the same fetch isn't repeated across the render tree.
- **Dynamic-import heavy, non-critical components** (`next/dynamic`, `ssr:false` when SSR isn't needed) to keep the initial bundle small.

## Runtime rendering (hit INP/CLS)
- **Break up long tasks (> 50 ms)**: chunk heavy loops and `await scheduler.yield()` (with fallback) periodically; never block the main thread in an event handler.
- **No layout thrash**: don't interleave DOM reads (`offsetWidth`, `getBoundingClientRect`) with writes in the same loop/frame — batch reads, then writes (`requestAnimationFrame`).
- **Debounce/throttle high-frequency handlers**: debounce input/search/auto-save (~200–500 ms); throttle `scroll`/`resize`/`pointermove`; no network call on an un-throttled high-frequency event (or `useDeferredValue`/`startTransition`).
- **Virtualize long lists** beyond ~50–100 rows (`react-window` or similar); no unbounded `.map()` of large datasets into the DOM.
- **`content-visibility: auto`** on large offscreen sections, always with **`contain-intrinsic-size`** (avoid CLS).
- Non-`preventDefault` `scroll`/`wheel`/`touch` listeners are **`{ passive: true }`**.
