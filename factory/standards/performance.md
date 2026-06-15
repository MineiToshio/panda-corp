# Performance (web)

> Domain: Quality · Severity: **MUST** (web projects with UI only; inapplicable to API/CLI/scraper). Enforcement: CI gate.

## Rule
- **Core Web Vitals at p75** (field): LCP ≤ 2.5 s · INP ≤ 200 ms · CLS ≤ 0.1. (Poor: >4 s / >500 ms / >0.25.)
- **JS budget** defined in the blueprint; no bundle regressions without justification.
- Images with Next's `<Image>` and fonts with `next/font` (avoids CLS). Lazy-load the non-critical.

## How it is verified
- **CI = lab proxy** (not the real p75, impossible in CI): Lighthouse CI (perf score + budget) + `@next/bundle-analyzer`; TBT as a proxy for INP. Gate **warn-on-PR / block-on-main** (like mutation testing, DR-016 — lab variance must not block every PR).
- **The real p75 is measured in the field** with `useReportWebVitals` → PostHog (already in the stack).

## Why
CWV are the contract of perceived experience and affect SEO. Measure in the field, not only in the lab, because the p75 depends on real devices/networks. See DR-024.

Sources: web.dev/articles/vitals · web.dev/articles/defining-core-web-vitals-thresholds · nextjs.org/docs/app/guides/production-checklist
