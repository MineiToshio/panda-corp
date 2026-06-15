# Bitácora — Plugin pandacorp

Decisiones sobre el plugin: skills, agentes, hooks, plantillas y flujo de la fábrica. Lo más reciente arriba. Ver índice y formato en [DECISION-LOG.md](../../DECISION-LOG.md).

> Recordatorio: tras editar `plugin/`, commitear y correr `claude plugin update pandacorp@panda-corp` (ver `CLAUDE.md`).

## 2026-06-15 — Skill `teach` renombrado a `learn` (refinamiento de nombre) · v3.0.0
**Qué:** El dueño prefirió `learn` sobre `teach` para el comando (la fábrica *aprende* el know-how). Se renombró `/pandacorp:teach` → `/pandacorp:learn` (mismo skill, misma función). Renombrar un skill = **MAJOR** (DR-034). Es un refinamiento de nombre el mismo día que el v2.0.0 (codify→teach), que nunca se llegó a usar (sin reinicio entre medio).
**Por qué:** `learn` comunica mejor que la fábrica incorpora/aprende el know-how durable.
**Impacto:** `plugin/skills/teach/` → `plugin/skills/learn/SKILL.md`, `plugin/.claude-plugin/plugin.json` (3.0.0), `factory/standards/README.md`, `mission-control/docs/frds/frd-07-configuration.md`, `mission-control/prototype/index.html`, `docs/proposals/08-standards-rules-catalog.md`. Activación: commit + `claude plugin update pandacorp@panda-corp` + reiniciar.

## 2026-06-15 — Rename `codify` → `teach` (+ teach crea skills delegando a skill-creator) · v2.0.0
**Qué:** Se renombró el comando `/pandacorp:codify` a `/pandacorp:teach` (el nombre "codify" se leía como "escribir código", lo opuesto a lo que hace: registrar know-how durable). `teach` ahora cubre un tercer artefacto además de estándar y regla de decisión: **crear/mejorar un skill**, delegando autoría y evaluación al `skill-creator` nativo (componer, no reinventar); teach solo agrega el gate del dueño, la colocación en el plugin, la política de seguridad/vendorizado de skills externos y el ritual de activación. Renombrar un skill = **MAJOR** (DR-034).
**Por qué:** El nombre confundía; y crear skills es know-how durable (dominio de `teach`), no producto (dominio de `implement`) — reusando `skill-creator` en vez de clonarlo.
**Impacto:** `plugin/skills/codify/` → `plugin/skills/teach/SKILL.md`, `plugin/.claude-plugin/plugin.json` (2.0.0), `factory/standards/README.md`, `mission-control/docs/frds/frd-07-configuration.md`, `mission-control/prototype/index.html`, `docs/proposals/08-standards-rules-catalog.md`. Activación: commit + `claude plugin update pandacorp@panda-corp` + reiniciar.

## 2026-06-15 — Renombre app/panel reflejado en los skills (cockpit→Mission Control, panel→Party) · v1.2.3
**Qué:** Tras el renombre de la app (ver [factory/decision-log.md](../../factory/decision-log.md) y [mission-control/docs/decision-log.md](../../mission-control/docs/decision-log.md)), se actualizó el vocabulario en los skills y artefactos del plugin: `implement`, `decide`, `recommend`, `codify`, `bug`, `blueprint` (prosa y descripciones: "el cockpit" → "Mission Control"; "se sigue en Mission Control" donde antes decía el panel), `plugin/scripts/emit-event.sh` y `plugin/templates/shared/docs/status.yaml.tpl` (comentarios). Sin cambio de comportamiento → bump **PATCH 1.2.2 → 1.2.3**.
**Por qué:** Los skills mencionan dónde "se sigue la construcción"; deben usar el nombre correcto (Mission Control = la app; Party = el panel RPG por proyecto).
**Impacto:** `plugin/.claude-plugin/plugin.json` (1.2.3), `plugin/skills/{implement,decide,recommend,codify,bug,blueprint}/SKILL.md`, `plugin/scripts/emit-event.sh`, `plugin/templates/shared/docs/status.yaml.tpl`. Activación: commit + `claude plugin update pandacorp@panda-corp` + reiniciar.

## 2026-06-15 — Onboarding profundo + discover/recommend según el perfil (dos corrientes)
**Qué:** El onboarding ahora captura intereses, hobbies, gustos/rechazos, objetivos, ACTIVOS/palancas (audiencia, red, nicho), apetito de monetización y tipos de proyecto. `discover` y `recommend` leen ese perfil y recomiendan en dos corrientes (~50/50: generales de alto retorno + alineadas al perfil aunque el ROI monetario sea menor), con retorno entendido como monetario U oportunidad, y alcance abierto a cualquier solución tecnológica. Detalle del modelo en [factory/ideas/decision-log.md](../../factory/ideas/decision-log.md) y DR-039.
**Por qué:** Que la fábrica recomiende cosas bien alineadas al dueño (sus gustos y activos), no genéricas, y que no se limite a apps monetizables.
**Impacto:** `plugin/skills/{onboarding,discover,recommend,new-idea}/SKILL.md`, `factory/profile.example.md`, `factory/ideas/_idea-template.md`, `factory/decisions/registry.yaml` (DR-039), `mission-control/prototype/index.html`.

## 2026-06-15 — Servicios externos, cuentas/secretos, pagos (Polar) y avisos de Vercel
**Qué:** Nuevo estándar `factory/standards/external-services.md` (stack de servicios probado, modelo de cuentas "1 org compartida + 1 primitivo por app", aprovisionamiento API-first, secretos en SOPS+age, pagos con Polar/MoR, notificación al dueño en gates). DR-035..038. Skills/agentes: el PRD declara explícitamente "¿v1 con pagos?", el blueprint/release avisan (warning, no bloqueo) cuando una versión que cobra usa Vercel (Hobby = no comercial, ban de cuenta completa → Pro), y cualquier gate dispara push al dueño.
**Por qué:** El dueño (en Perú) lanza muchas apps de prueba; necesita estandarizar servicios, gestionar cuentas/secretos de forma autónoma ("dejarlo corriendo") y que Vercel sea un aviso, no un impedimento. Stripe directo no opera en Perú → Polar (MoR).
**Impacto:** `factory/standards/external-services.md` (nuevo), `factory/standards/stack.md`, `factory/decisions/registry.yaml` (DR-035..038), `plugin/agents/{product-manager,devops,architect}.md`, `plugin/skills/{spec,blueprint,release}/SKILL.md`, `factory/standards/README.md` (índice), `CLAUDE.md`, `plugin/.claude-plugin/plugin.json` (1.1.0 → 1.2.1). Incluye §9 (setup operativo SOPS+age) y §10 (fundamentos verificados con fuentes).

## 2026-06-14 — Versionado semver del plugin (DR-034) + quita de referencia a proyecto privado
**Qué:** El plugin estrena `version` en `plugin/.claude-plugin/plugin.json` (arranca en `1.0.0`) y se adopta la política: subir la versión en cada cambio de `plugin/` según semver (PATCH/MINOR/MAJOR). Además se quitaron las menciones a un proyecto privado del dueño que se citaba como referencia en `factory/standards/README.md` y `plugin/templates/stack-a-nextjs/STACK.md` — el contenido se mantiene como estándar/stack recomendado, sin atarlo a un proyecto que nadie más puede ver.
**Por qué:** El dueño pidió versionar y que la versión se actualice siempre según el tamaño del cambio; y que el repo público no referencie un proyecto suyo que nadie más puede ver. El validador del plugin además avisaba de la falta de `version`.
**Impacto:** `plugin/.claude-plugin/plugin.json` (version), `CLAUDE.md` (Mantenimiento del plugin + política semver), `factory/decisions/registry.yaml` (DR-034), `factory/standards/README.md`, `plugin/templates/stack-a-nextjs/STACK.md`.

## 2026-06-14 — Skill `onboarding` + rutas portables (preparación para repo público)
**Qué:** Nuevo skill `/pandacorp:onboarding`: entrevista al dueño y genera `factory/profile.md` (personal), con bootstrap de `portfolio.md` desde el seed. Además, los skills/scripts dejaron de hardcodear la ruta de la fábrica: `scan-ideas.sh` auto-detecta la raíz (repo root), `spec`/`scaffold` crean proyectos relativos a la fábrica (o `ruta_proyectos` del perfil), y `CLAUDE.md.tpl` usa el placeholder `{{FACTORY_PATH}}`.
**Por qué:** Parte de abrir la fábrica como plantilla reutilizable (ver [factory/decision-log.md](../../factory/decision-log.md)). El onboarding reemplaza la identidad hardcodeada del dueño; las rutas relativas la hacen funcionar en cualquier máquina.
**Impacto:** `plugin/skills/onboarding/SKILL.md` (nuevo), `plugin/scripts/scan-ideas.sh`, `plugin/skills/{spec,scaffold,new-idea,recommend,explore,sync-portfolio}/SKILL.md`, `plugin/templates/shared/CLAUDE.md.tpl`.

## 2026-06-14 — Bitácora del plugin creada
**Qué:** Arranca la bitácora de decisiones del plugin.
**Por qué:** Parte de la disciplina "documentar todo" de la fábrica — ver [factory/decision-log.md](../../factory/decision-log.md). Hasta ahora las decisiones sobre skills/agentes vivían solo en commits.
