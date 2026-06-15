# Performance (web)

> Dominio: Calidad · Severidad: **MUST** (solo proyectos web con UI; inaplicable a API/CLI/scraper). Enforcement: CI gate.

## Regla
- **Core Web Vitals al p75** (campo): LCP ≤ 2.5 s · INP ≤ 200 ms · CLS ≤ 0.1. (Pobre: >4 s / >500 ms / >0.25.)
- **Presupuesto de JS** definido en el blueprint; sin regresiones de bundle sin justificar.
- Imágenes con el `<Image>` de Next y fuentes con `next/font` (evita CLS). Lazy-load de lo no-crítico.

## Cómo se verifica
- **CI = proxy de laboratorio** (no el p75 real, imposible en CI): Lighthouse CI (perf score + budget) + `@next/bundle-analyzer`; TBT como proxy de INP. Gate **warn-on-PR / block-on-main** (como mutation testing, DR-016 — la varianza de laboratorio no debe bloquear cada PR).
- **El p75 real se mide en campo** con `useReportWebVitals` → PostHog (ya en el stack).

## Por qué
CWV son el contrato de experiencia percibida y afectan SEO. Medir en campo, no solo en laboratorio, porque el p75 depende de dispositivos/redes reales. Ver DR-024.

Fuentes: web.dev/articles/vitals · web.dev/articles/defining-core-web-vitals-thresholds · nextjs.org/docs/app/guides/production-checklist
