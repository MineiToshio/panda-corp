# {{PROJECT_NAME}}

Proyecto de la fábrica **Pandacorp**. Todo el ciclo de vida se gestiona con los skills `/pandacorp:*`.

## Origen — Pandacorp

- Fábrica: `/Users/Shared/Proyectos/panda-corp` (know-how, base de ideas, portfolio)
- Ficha de idea original: `{{IDEA_FILE}}` (copia congelada en `docs/idea-origen.md`)
- Estándares y proceso: vienen del **plugin pandacorp** — NO buscarlos en la fábrica
- TODA la documentación de este producto vive AQUÍ en `docs/` — nunca en la fábrica
- Estado del proyecto: `docs/estado.yaml` (la fábrica lo lee para su portfolio; mantenerlo al día)

## Mapa de documentación

| Qué | Dónde |
|---|---|
| Investigación de producto | `docs/investigacion-producto.md` |
| PRD | `docs/prd.md` |
| FRDs (funcionalidades + criterios EARS) | `docs/frds/` |
| Diseño (referencias, tokens, mockups, decisiones) | `docs/diseno/` + `DESIGN.md` |
| Blueprint técnico | `docs/blueprint.md` |
| ADRs | `docs/adr/` |
| Work orders | `docs/work-orders/` |
| Reviews y auditorías | `docs/reviews/` |

## Reglas del proyecto

1. Idioma: docs en español; código, commits e identificadores en inglés.
2. Conventional Commits con scope, en feature branches. Nunca push directo a main, nunca force push.
3. TDD: tests de criterios de aceptación ANTES de implementar. Nada se declara terminado con tests rojos — `.pandacorp/verify.sh` debe pasar.
4. UI solo con design tokens de `docs/diseno/design-tokens.json` — cero valores hardcodeados. `data-testid` en elementos interactivos.
5. Prohibido: `any`, `@ts-ignore`, secretos en código, auth casero, dependencias que violen DR-001 de la fábrica.
6. Decisiones no cubiertas por los documentos: consultar el registro de la fábrica (`fabrica/decisiones/registro.yaml`); si no está, escalar a Sergio.

## Fase actual

Ver `docs/estado.yaml`. Pipeline: producto → diseño → arquitectura → work-orders → implementación → release → operación.
