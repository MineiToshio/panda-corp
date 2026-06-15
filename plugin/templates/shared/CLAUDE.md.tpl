# {{PROJECT_NAME}}

Proyecto de la fábrica **Pandacorp**. Todo el ciclo de vida se gestiona con los skills `/pandacorp:*`.

## Origen — Pandacorp

- Fábrica: `{{FACTORY_PATH}}` (know-how, base de ideas, portfolio)
- Ficha de idea original: `{{IDEA_FILE}}` (copia congelada en `docs/idea-origin.md`)
- Estándares y proceso: vienen del **plugin pandacorp** — NO buscarlos en la fábrica
- TODA la documentación de este producto vive AQUÍ en `docs/` — nunca en la fábrica
- Estado del proyecto: `docs/status.yaml` (la fábrica lo lee para su portfolio; mantenerlo al día)

## Mapa de documentación

| Qué | Dónde |
|---|---|
| Investigación de producto | `docs/product-research.md` |
| PRD | `docs/prd.md` |
| FRDs (funcionalidades + criterios EARS) | `docs/frds/` |
| Diseño (referencias, tokens, mockups, decisiones) | `docs/design/` + `DESIGN.md` |
| Blueprint técnico | `docs/blueprint.md` |
| ADRs | `docs/adr/` |
| Work orders | `docs/work-orders/` |
| Reviews y auditorías | `docs/reviews/` |
| **Bitácora** (decisiones + porqué, historia) | `docs/decision-log.md` |

## Reglas del proyecto

> **Estándares de código: ver `AGENTS.md`** (convenciones duraderas de la fábrica). El stack concreto está en `docs/blueprint.md`.

1. Idioma: docs en español; código, commits e identificadores en inglés.
2. Conventional Commits con scope, en feature branches. Nunca push directo a main, nunca force push.
3. TDD: tests de criterios de aceptación ANTES de implementar. Nada se declara terminado con tests rojos — `.pandacorp/verify.sh` debe pasar.
4. UI solo con design tokens de `docs/design/design-tokens.json` — cero valores hardcodeados. `data-testid` en elementos interactivos.
5. Prohibido: `any`, `@ts-ignore`, secretos en código, auth casero, dependencias que violen DR-001 de la fábrica.
6. Decisiones no cubiertas por los documentos: consultar el registro de la fábrica (`factory/decisions/registry.yaml`); si no está, escalar al dueño.
7. Documentar todo (dos capas): cada cambio relevante actualiza su **doc canónico** (comportamiento → el FRD; técnico → blueprint + ADR; diseño → DESIGN/tokens; alcance → PRD) **y** añade una entrada en `docs/decision-log.md` con el porqué, enlazando el doc. Ver `AGENTS.md`.

## Fase actual

Ver `docs/status.yaml`. Pipeline: producto → diseño → arquitectura → construcción → release → operación.
