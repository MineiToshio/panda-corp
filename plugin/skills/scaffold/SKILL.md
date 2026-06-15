---
description: Crea la carpeta/repo de un proyecto Pandacorp desde una idea (paso mecánico del handoff). En el flujo normal lo invoca /pandacorp:spec; usar por separado solo para crear el proyecto sin documentar todavía.
---

# /pandacorp:scaffold

Crea el proyecto para la idea indicada en `$ARGUMENTS` (nombre de ficha o slug).

## Pasos

1. **Valida**: lee la ficha en `factory/ideas/<idea>.md` (en la raíz de la fábrica). Debe existir y estar en `estado: recomendada` (o `documentada`). Ejecutar este skill ES la selección del dueño. Si la ficha está en `descartada` o `en-pipeline`, detente y confirma.
2. **Crea la carpeta** `<slug-en-ingles>/` como **hermana de la raíz de la fábrica** (NUNCA dentro). Por defecto el directorio padre de la fábrica; si `factory/profile.md` define `ruta_proyectos`, úsala. Inicializa git con branch `main`.
3. **Copia el overlay Pandacorp** desde las plantillas del plugin:
   ```bash
   cp -r "${CLAUDE_PLUGIN_ROOT}/templates/shared/." "<destino>/"
   ```
   Procesa los `.tpl`: reemplaza `{{PROJECT_NAME}}` (slug), `{{IDEA_FILE}}` (ruta de la ficha), `{{FACTORY_PATH}}` (ruta absoluta de la raíz de la fábrica), `{{DATE}}` (hoy) y renombra quitando `.tpl`. El overlay ya incluye `.claude/workflows/pandacorp-build.js` (el motor de construcción que lanza `implement`) y `.claude/settings.json`.
4. **Estructura de docs**: crea `docs/` con subcarpetas vacías `frds/`, `diseno/mockups/`, `adr/`, `work-orders/`, `reviews/`. Copia la ficha de la idea a `docs/idea-origin.md` (copia congelada de referencia). El overlay ya siembra `docs/status.yaml`, `docs/iteration.md` (iteración en sitio, DR-032) y `docs/decision-log.md` (historia de decisiones — estándar de dos capas, `documentation.md`).
5. **NO instales el stack todavía** — eso lo decide el blueprint en fase de arquitectura. El proyecto nace solo con docs + overlay. (La guía de cada stack está en `${CLAUDE_PLUGIN_ROOT}/templates/stack-*/STACK.md` para cuando llegue el momento.)
6. **Enlaces bidireccionales**:
   - Ficha de la idea: `estado: en-pipeline`, campo `proyecto:` con la ruta.
   - `factory/portfolio.md`: agrega la fila (proyecto, ruta, repo pendiente, idea origen, fase `producto`, fecha).
   - El CLAUDE.md del proyecto ya trae la sección "Origen — Pandacorp" (viene de la plantilla).
7. **Repo GitHub** (DR-010: privado auto-aprobado): si `gh` está autenticado, crea el repo privado y haz push inicial; si no, déjalo anotado como pendiente en `docs/status.yaml`.
8. **Commit inicial** en el proyecto: `chore: scaffold project from pandacorp factory`.
9. Reporta: ruta creada, qué quedó configurado y el siguiente paso — abrir una sesión en el proyecto y correr `/pandacorp:spec`.

## Reglas
- Slug del proyecto en inglés, kebab-case.
- Nunca crear el proyecto dentro de panda-corp.
- Si la carpeta destino ya existe, detente y pregunta — nunca sobreescribas.
