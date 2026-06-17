---
title: "Stacks (golden paths)"
group: concepts
order: 9
---

# Stacks (golden paths)

Un "golden path" es el stack tecnológico por defecto aprobado para un tipo de proyecto. La fábrica tiene golden paths pre-aprobados que aceleran el arranque — el arquitecto los propone en el blueprint y el propietario los aprueba en ese momento (ADR ligero).

## El stack por defecto (web)

Definido en `factory/standards/stack.md`. Siempre en las últimas versiones estables:

| Capa | Tecnología |
|---|---|
| Framework | Next.js (App Router) |
| Lenguaje | TypeScript strict |
| Estilos | CSS variables + design tokens (shadcn/ui como base de componentes) |
| Base de datos | Postgres (via Supabase o Neon) |
| Auth | Better Auth o Supabase Auth |
| ORM | Drizzle ORM |
| Tests | Vitest + Testing Library + Playwright (e2e) |
| Lint/Format | Biome |
| Despliegue | Vercel (web) |
| Secretos | SOPS + age |
| Pagos | Polar |
| Analítica | PostHog |

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
