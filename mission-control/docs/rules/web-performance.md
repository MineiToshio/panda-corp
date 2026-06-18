---
description: Web performance — Core Web Vitals plus runtime/data-fetching patterns (no waterfalls, dedup, no barrel imports).
applies_when: web-ui
globs: ["app/**", "src/**"]
source: Pandacorp standard — performance
---

# Web performance

## Core Web Vitals (the target, measured in the field at p75)
- **LCP ≤ 2.5 s · INP ≤ 200 ms · CLS ≤ 0.1.**
- Images via the framework's `<Image>`, fonts via `next/font` (avoids CLS). Lazy-load the non-critical.
- A JS budget is defined up front; no bundle regressions without justification.

## Runtime & data-fetching
- **No request waterfalls.** Fire independent async work concurrently (`Promise.all`); `await` only where the value is used (defer awaits into the branch that needs them).
- **Deduplicate per request** with `React.cache()` (or the framework's request cache) so the same fetch isn't repeated across the render tree.
- **Avoid barrel-file imports in hot paths** (`import { x } from '@/components'`) — they drag the whole module graph (200–800 ms). Import from the concrete file.
- **Dynamic-import heavy, non-critical components** (`next/dynamic`, `ssr:false` when they don't need SSR) to keep the initial bundle small.

## Runtime rendering (hit the INP/CLS targets)
- **Break up long tasks (> 50 ms).** Chunk heavy loops/work and `await scheduler.yield()` (with a fallback) periodically; never block the main thread in an event handler.
- **No layout thrash.** Don't interleave DOM **reads** (`offsetWidth`, `getBoundingClientRect`, `getComputedStyle`) with **writes** in the same loop/frame — batch reads, then writes (schedule via `requestAnimationFrame`).
- **Debounce/throttle high-frequency handlers.** Debounce input/search/auto-save (~200–500 ms); throttle `scroll`/`resize`/`pointermove`. No network call on an un-throttled high-frequency event (or use `useDeferredValue`/`startTransition`).
- **Virtualize long lists** (`react-window` or similar) once they exceed ~50–100 rows; no unbounded `.map()` of large datasets into the DOM.
- **`content-visibility: auto`** on large offscreen sections, always with **`contain-intrinsic-size`** to reserve space (avoid CLS).
- Register non-`preventDefault` `scroll`/`wheel`/`touch` listeners as **`{ passive: true }`**.
