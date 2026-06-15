# Bitácora — Plugin pandacorp

Decisiones sobre el plugin: skills, agentes, hooks, plantillas y flujo de la fábrica. Lo más reciente arriba. Ver índice y formato en [BITACORA.md](../../BITACORA.md).

> Recordatorio: tras editar `plugin/`, commitear y correr `claude plugin update pandacorp@panda-corp` (ver `CLAUDE.md`).

## 2026-06-15 — Onboarding profundo + discover/recommend según el perfil (dos corrientes)
**Qué:** El onboarding ahora captura intereses, hobbies, gustos/rechazos, objetivos, ACTIVOS/palancas (audiencia, red, nicho), apetito de monetización y tipos de proyecto. `discover` y `recommend` leen ese perfil y recomiendan en dos corrientes (~50/50: generales de alto retorno + alineadas al perfil aunque el ROI monetario sea menor), con retorno entendido como monetario U oportunidad, y alcance abierto a cualquier solución tecnológica. Detalle del modelo en [fabrica/ideas/bitacora.md](../../fabrica/ideas/bitacora.md) y DR-039.
**Por qué:** Que la fábrica recomiende cosas bien alineadas al dueño (sus gustos y activos), no genéricas, y que no se limite a apps monetizables.
**Impacto:** `plugin/skills/{onboarding,discover,recommend,new-idea}/SKILL.md`, `fabrica/perfil.example.md`, `fabrica/ideas/_plantilla-ficha.md`, `fabrica/decisiones/registro.yaml` (DR-039), `cockpit/prototype/index.html`.

## 2026-06-15 — Servicios externos, cuentas/secretos, pagos (Polar) y avisos de Vercel
**Qué:** Nuevo estándar `fabrica/estandares/servicios-externos.md` (stack de servicios probado, modelo de cuentas "1 org compartida + 1 primitivo por app", aprovisionamiento API-first, secretos en SOPS+age, pagos con Polar/MoR, notificación al dueño en gates). DR-035..038. Skills/agentes: el PRD declara explícitamente "¿v1 con pagos?", el blueprint/release avisan (warning, no bloqueo) cuando una versión que cobra usa Vercel (Hobby = no comercial, ban de cuenta completa → Pro), y cualquier gate dispara push al dueño.
**Por qué:** El dueño (en Perú) lanza muchas apps de prueba; necesita estandarizar servicios, gestionar cuentas/secretos de forma autónoma ("dejarlo corriendo") y que Vercel sea un aviso, no un impedimento. Stripe directo no opera en Perú → Polar (MoR).
**Impacto:** `fabrica/estandares/servicios-externos.md` (nuevo), `fabrica/estandares/stack.md`, `fabrica/decisiones/registro.yaml` (DR-035..038), `plugin/agents/{product-manager,devops,architect}.md`, `plugin/skills/{spec,blueprint,release}/SKILL.md`, `fabrica/estandares/README.md` (índice), `CLAUDE.md`, `plugin/.claude-plugin/plugin.json` (1.1.0 → 1.2.1). Incluye §9 (setup operativo SOPS+age) y §10 (fundamentos verificados con fuentes).

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
