# AGENTS.md — {{PROJECT_NAME}}

Estándares para cualquier agente de IA que trabaje en este proyecto. Es la fuente de verdad de convenciones, alineada con los estándares de la fábrica Pandacorp. (Claude Code también lee `CLAUDE.md`, que apunta aquí.)

## Orden de prioridad
Pedido del usuario → este AGENTS.md → documentos del proyecto en `docs/` → defaults del lenguaje.

## Convenciones duraderas (obligatorias)

**Idioma**: código en inglés (variables, funciones, tipos, comentarios, commits). Documentos en español. Contenido visible al usuario vía i18n (nunca hardcodeado).

**Tipado**: estricto siempre (TS `strict` / `mypy --strict`). Prohibido `any` y `@ts-ignore`. Preferir `unknown`.

**Estructura**: data layer aislado (todo acceso a BD en `queries/` o capa equivalente, nunca desde componentes). Código por feature (`_components/`, `_actions/`, `_schemas/`). Reuso antes de crear (revisar `components/core` → `modules` → local). Tests colocados; e2e en `e2e/`.

**Patrones** (stack web): Server Components por defecto, `"use client"` solo si hace falta; Server Actions primero; UI optimista (actualizar y revertir si falla); HTML semántico + a11y (axe-core); tema claro/oscuro con variables semánticas; estilos solo con design tokens (`docs/design/design-tokens.json`), nunca colores hardcodeados.

**Constantes**: sin magic strings/números; centralizar en `lib/constants.ts`. Validar inputs en fronteras con Zod (o equivalente).

**Commits**: Conventional Commits con scope, en inglés. Feature branches; nunca push directo a main ni force push.

**Calidad — antes de dar algo por terminado** (lo verifica `.pandacorp/verify.sh`): tests verdes + type-check + lint/format sin errores. TDD por work order (RED → GREEN → refactor). E2E solo en flujos críticos con `data-testid`.

**Documentación (dos capas)**: todo cambio relevante actualiza su **doc canónico** —comportamiento → el FRD correspondiente (`docs/frds/`); técnico → `docs/blueprint.md` + un ADR; diseño → `DESIGN.md`/tokens; alcance → `docs/prd.md`— **y** añade una entrada en `docs/decision-log.md` (fecha, qué, por qué, enlace al doc). El doc canónico es la verdad actual; la bitácora, la historia. Un cambio de comportamiento no está terminado sin su FRD actualizado y su entrada de bitácora. Estándar: `documentation.md` de la fábrica.

## Stack de este proyecto
Definido en `docs/blueprint.md` (elegido y aprobado en la fase de arquitectura). Ver ahí versiones y servicios concretos.

## Detalle
Estándares completos de la fábrica: convenciones, estructura, patrones, calidad y stack recomendado. Si algo no está aquí, seguir el espíritu de estos principios y, si es una decisión recurrente, consultar el registro de decisiones de la fábrica.
