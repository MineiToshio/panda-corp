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
