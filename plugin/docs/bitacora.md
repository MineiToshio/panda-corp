# Bitácora — Plugin pandacorp

Decisiones sobre el plugin: skills, agentes, hooks, plantillas y flujo de la fábrica. Lo más reciente arriba. Ver índice y formato en [BITACORA.md](../../BITACORA.md).

> Recordatorio: tras editar `plugin/`, commitear y correr `claude plugin update pandacorp@panda-corp` (ver `CLAUDE.md`).

## 2026-06-14 — Versionado semver del plugin (DR-034) + quita de referencia a proyecto privado
**Qué:** El plugin estrena `version` en `plugin/.claude-plugin/plugin.json` (arranca en `1.0.0`) y se adopta la política: subir la versión en cada cambio de `plugin/` según semver (PATCH/MINOR/MAJOR). Además se quitaron las menciones a un proyecto privado del dueño que se citaba como referencia en `fabrica/estandares/README.md` y `plugin/templates/stack-a-nextjs/STACK.md` — el contenido se mantiene como estándar/stack recomendado, sin atarlo a un proyecto que nadie más puede ver.
**Por qué:** El dueño pidió versionar y que la versión se actualice siempre según el tamaño del cambio; y que el repo público no referencie un proyecto suyo que nadie más puede ver. El validador del plugin además avisaba de la falta de `version`.
**Impacto:** `plugin/.claude-plugin/plugin.json` (version), `CLAUDE.md` (Mantenimiento del plugin + política semver), `fabrica/decisiones/registro.yaml` (DR-034), `fabrica/estandares/README.md`, `plugin/templates/stack-a-nextjs/STACK.md`.

## 2026-06-14 — Skill `onboarding` + rutas portables (preparación para repo público)
**Qué:** Nuevo skill `/pandacorp:onboarding`: entrevista al dueño y genera `fabrica/perfil.md` (personal), con bootstrap de `portfolio.md` desde el seed. Además, los skills/scripts dejaron de hardcodear la ruta de la fábrica: `scan-ideas.sh` auto-detecta la raíz (repo root), `spec`/`scaffold` crean proyectos relativos a la fábrica (o `ruta_proyectos` del perfil), y `CLAUDE.md.tpl` usa el placeholder `{{FACTORY_PATH}}`.
**Por qué:** Parte de abrir la fábrica como plantilla reutilizable (ver [fabrica/bitacora.md](../../fabrica/bitacora.md)). El onboarding reemplaza la identidad hardcodeada del dueño; las rutas relativas la hacen funcionar en cualquier máquina.
**Impacto:** `plugin/skills/onboarding/SKILL.md` (nuevo), `plugin/scripts/scan-ideas.sh`, `plugin/skills/{spec,scaffold,new-idea,recommend,explore,sync-portfolio}/SKILL.md`, `plugin/templates/shared/CLAUDE.md.tpl`.

## 2026-06-14 — Bitácora del plugin creada
**Qué:** Arranca la bitácora de decisiones del plugin.
**Por qué:** Parte de la disciplina "documentar todo" de la fábrica — ver [fabrica/bitacora.md](../../fabrica/bitacora.md). Hasta ahora las decisiones sobre skills/agentes vivían solo en commits.
