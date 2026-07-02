---
title: "Stacks (golden paths)"
group: concepts
order: 9
---

# Stacks (golden paths)

Un "golden path" es el stack tecnológico por defecto aprobado para un tipo de proyecto. La fábrica tiene **3 golden paths documentados** (el viejo D —scraping— se plegó en C: era el mismo stack Python) más una lista de **puntos de partida** para casos nuevos. El arquitecto los propone en el blueprint y el propietario los aprueba en ese momento (ADR ligero).

## A — Web full-stack (el default, validado en producción)

Definido en `factory/standards/stack.md`. Siempre en las últimas versiones estables:

| Capa | Tecnología |
|---|---|
| Framework | Next.js (App Router) + React |
| Lenguaje | TypeScript strict |
| Estilos | Tailwind + design tokens (shadcn/ui como base de componentes) |
| Base de datos | Postgres en **Neon** (Supabase evaluado y rechazado) |
| Auth | Better Auth |
| ORM | **Prisma** (data layer en `queries/`) |
| Tests | Vitest + Testing Library + Playwright (e2e) |
| Lint/Format | Biome |
| Despliegue | Vercel (web) |
| Secretos | SOPS + age |
| Pagos | Polar |
| Analítica | PostHog + Sentry |

## B — API / servicio TypeScript

**Hono** (corre en Node/Bun/Workers) + Zod en cada boundary + OpenAPI **derivado de los schemas** + Drizzle + Postgres (Neon). Deploy: contenedor en Railway/Fly. Solo para servicios *headless* (webhooks, gateways, APIs para clientes externos) — la API de una web app vive en los route handlers del path A.

## C — Datos / scraping / APIs Python (absorbe el viejo D)

Python 3.12 + **uv** + ruff + mypy strict + **FastAPI** + Pydantic v2 + SQLAlchemy/Alembic. Scraping: httpx + parsel (Playwright **solo** para páginas con JS), cola ARQ/Redis, scraping responsable obligatorio (robots.txt, rate limiting propio, user-agent identificable).

## Puntos de partida (aún sin validar en producción)

Para casos que todavía no han construido un proyecto real: **CLI** (Commander/Typer), **extensión de navegador** (WXT), **sitio estático** (Astro), **app de agentes IA** (Claude Agent SDK para agentes autónomos; Vercel AI SDK para features de IA dentro de una web). El primer build real los endurece a golden path completo.

## Cómo se elige el stack

1. El arquitecto analiza los requisitos del proyecto.
2. Propone el stack en el blueprint (`docs/product/architecture.md`), justificando desviaciones del golden path.
3. El propietario lo aprueba — esta es la gate de arquitectura.
4. La decisión queda registrada como ADR en `docs/adr/`.

No es obligatorio usar el golden path — el arquitecto puede proponer alternativas si hay razones técnicas sólidas. Pero debe justificarlas y el propietario debe aprobarlas.

## Para Mission Control específicamente

Mission Control es un caso especial: vive dentro de la fábrica, no tiene deploy a producción y es una herramienta personal (no un producto). Su stack sigue el golden path web con estas particularidades:

- No tiene base de datos — lee el sistema de ficheros de la fábrica.
- No tiene auth — es una herramienta local en `localhost:3000`.
- No tiene pagos ni analítica de producto.
- Su despliegue es `pnpm dev` en local.

## Dependencias y DR-001

Añadir cualquier dependencia nueva requiere aprobación implícita o explícita según DR-001:

- **Aprobadas** — las del stack por defecto y sus ecosistemas documentados.
- **Nuevas** — requieren que el agente justifique la necesidad y el propietario las apruebe antes de `npm install`.
- **Prohibidas** — librerías con CVEs conocidos, sin mantenimiento en los últimos 12 meses, o que dupliquen funcionalidad ya aprobada.

## Por qué golden paths

La consistencia entre proyectos reduce el coste de contexto de los agentes: no tienen que redescubrir las mismas convenciones. Un agente que ha construido 5 proyectos Next.js con Drizzle + Better Auth puede arrancar un nuevo proyecto sin fricción de setup.
