<!--
  ARCHITECTURE DIGEST — the owner-facing Spanish summary of the platform architecture, rendered
  NATIVELY by Mission Control's "Arquitectura" tab (after Spec). It lives at
  `.pandacorp/comms/arquitectura-resumen.md` (gitignored Spanish layer — the underlying
  architecture.md / ADRs / blueprints stay English in `docs/`). It is a HIGH-LEVEL, visual,
  scannable overview — NOT a copy of the docs. The tab shows it only when this file exists, so the
  column appears once the project reaches the architecture phase.

  WHAT THE TAB READS LIVE (do NOT duplicate it here — the tab reads the real artifacts so they never drift):
  · The implementation-plan DAG — from the work-order frontmatter (`docs/frds/*/work-orders/*.md`:
    `id`, `parent`, `implementation_status`, `dependsOn`).
  · The ADRs — from `docs/adr/*.md` (title + the decision; clickable → the ADR body).
  · The env vars — from `.env.example` (name + the leading `#` comment).
  So this digest carries only the NARRATIVE: the stack, the data model, the communication/services
  and one card per FRD. Keep it SHORT.

  HOW IT'S CONSUMED (the rendering contract — keep the markers EXACTLY):
  · YAML frontmatter `proyecto` + `fase` + `stack` (one-liner) + `coste` (e.g. "$0/mes") + `host`
    → the hero (title + the stack one-liner + chips: host · coste · fase).
  · The first `>` blockquote line → the intro under the title.
  · `## 🧱 Stack & tecnologías` → a compact TABLE with EXACTLY three columns `Capa | Elección | Por qué`
    (markdown table; the tab renders it as the stack matrix). One row per layer, from `architecture.md`.
  · `## 🗄️ Modelo de datos` → **CONDITIONAL** (render only when present):
      - With a database: the entities, one bullet each `- **Entidad** — campos/qué guarda`.
      - Content-as-code / NO database: a lead line that CONTAINS the phrase **"Sin base de datos"**
        (the tab detects it and renders the "Sin BD" branch), then the content entities as bullets
        `- **BlogPost** — qué es`.
  · `## 🔌 Comunicación & servicios` → how the app talks to the outside, bullets `- **Servicio** — cómo/qué`.
  · `## 🧩 Por FRD` → one `### FRD-NN · Título` card per FRD, each with:
      `**Blueprint:**` a one-line summary of that feature's implementation design, then
      `**Work orders:**` a bullet list `- **WO-NN-MMM** — one-liner` (summarized, not the full WO).
    Clicking a card opens a modal with the blueprint line + the work-orders list.
  · Spanish (owner-facing). Keep it SCANNABLE — a table + a few bullets each, not the full docs.

  This file is the blank contract; below is a FILLED MINI-EXAMPLE to copy the shape from.
-->
---
proyecto: "<Nombre del proyecto>"
fase: arquitectura
stack: "Next.js (App Router, SSG) · React · TypeScript · Tailwind"
coste: "$0/mes"
host: "Vercel Hobby"
---

> Sitio estático bilingüe, sin backend ni base de datos: el contenido es código y todo se compila a HTML. Los documentos completos (en inglés) están en la pestaña Documentos.

## 🧱 Stack & tecnologías

| Capa | Elección | Por qué |
|---|---|---|
| Framework / UI | Next.js (App Router) · React | RSC, SSG por ruta, APIs nativas de metadata/sitemap/OG |
| Lenguaje | TypeScript strict | Sin `any`, sin `@ts-ignore` |
| Estilos | Tailwind v4 (`@theme` ← tokens) | Cero valores hardcodeados |
| Contenido | Content Collections + Zod + Shiki (MDX) | Capa de contenido type-safe, fail-loud en build |
| Contacto | Web3Forms (POST cliente) | $0, sin backend, sin secreto de servidor |
| Analítica | PostHog (SDK navegador) | $0, sin PII |
| Hosting | Vercel Hobby | Estático, $0 |

## 🗄️ Modelo de datos

Sin base de datos — el contenido es código (validado en build, fail-loud). No se escribe nada en runtime.

- **BlogPost** — posts MDX por locale (`title`, `date`, `tags`, `draft`, `body`).
- **CaseStudy** — los estudios de caso destacados (problema · decisiones · impacto).
- **About / Now** — prosa MDX corta por locale.

## 🔌 Comunicación & servicios

- **Web3Forms** — el formulario de contacto hace POST desde el cliente con la key pública; no hay server runtime.
- **PostHog** — telemetría solo-cliente, no bloqueante, sin PII.
- **Sin API propia** — todo es estático; la única decisión en request-time es el redirect de locale en `/`.

## 🧩 Por FRD

### FRD-01 · Site shell · i18n · theming
**Blueprint:** layout `[locale]` + nav/footer + i18n (next-intl) + tema (next-themes, dark por defecto, sin flash).
**Work orders:**
- **WO-00-001** — design system: tokens → Tailwind `@theme` + primitivos core.
- **WO-01-002** — i18n plumbing: routing/middleware + `localizedHref` + bundles.
- **WO-01-001** — app shell: layout + Nav + Footer + ThemeToggle + LangSwitcher.

### FRD-02 · Home
**Blueprint:** home estática (hero + skills + "cómo uso IA" + un único CTA de contacto).
**Work orders:**
- **WO-02-001** — página home + sus componentes.
