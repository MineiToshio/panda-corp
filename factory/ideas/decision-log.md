# Bitácora — Ideas

Decisiones sobre la **base de ideas y su proceso** (scoring, descarte, flujo de descubierta). Lo más reciente arriba. Ver índice y formato en [DECISION-LOG.md](../../DECISION-LOG.md).

> Ojo: el contenido y estado de **cada idea** vive en su propia ficha (`factory/ideas/<slug>.md`, frontmatter). Aquí van decisiones sobre **cómo gestionamos las ideas**, no las ideas en sí.

## 2026-06-15 — Esquema de ficha: categoría (tipo_proyecto) + retorno, sin el tag binario
**Qué:** La ficha reemplaza el tag `tipo` (monetizable/personal/ambas) por dos ejes ortogonales: `tipo_proyecto` (web/mobile/desktop/ia/claude-code/prompt-system/automatizacion/cli/rework/otro) y `retorno` (monetario/oportunidad/personal/mixto), más `alineacion_perfil`. `new-idea` clasifica siempre ambos.
**Por qué:** El tag binario no distinguía QUÉ tipo de solución es ni capturaba que el retorno puede ser de oportunidad y no solo dinero. Alinea la ficha con el modelo de recomendación (DR-039) y con los tags del tablero (Mission Control FRD-02).
**Impacto:** `factory/ideas/_idea-template.md`, `plugin/skills/new-idea/SKILL.md`. Reflejado en `mission-control/` (FRD-02) y DR-039.

## 2026-06-15 — Recomendaciones según el perfil del dueño (dos corrientes + doble valor)
**Qué:** `discover` y `recommend` ahora leen `factory/profile.md` y proponen ideas en dos corrientes (~50/50): oportunidades generales de alto retorno, y oportunidades alineadas al perfil (intereses/activos) aunque su retorno monetario sea menor. El "retorno" deja de ser solo dinero: incluye oportunidad (alcance/red/posicionamiento), aprendizaje y valor personal. El alcance se abre a cualquier solución tecnológica (app web/mobile, rework, tooling/proyecto de Claude Code, prompt o sistema de prompts, automatización). La ficha suma `tipo_proyecto`, `alineacion_perfil` y `retorno`; el scoring de `new-idea` pondera retorno y encaje.
**Por qué:** El dueño quiere recomendaciones bien alineadas a él —sus intereses, objetivos y activos (p. ej. una audiencia que abre puertas)— sin perder las grandes oportunidades generales. No todo tiene que ser una app ni monetizar fuerte: importa un problema real con buen retorno (monetario o de oportunidad).
**Impacto:** `plugin/skills/{discover,recommend,new-idea,onboarding}/SKILL.md`, `factory/profile.example.md`, `factory/ideas/_idea-template.md`, `factory/constitution.md` (misión), `factory/decisions/registry.yaml` (DR-039), `mission-control/prototype/index.html`.

## 2026-06-14 — Bitácora de ideas creada
**Qué:** Arranca la bitácora de decisiones sobre la base de ideas.
**Por qué:** Parte de la disciplina "documentar todo" de la fábrica — ver [factory/decision-log.md](../decision-log.md).
