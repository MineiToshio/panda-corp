# Bitácora — Ideas

Decisiones sobre la **base de ideas y su proceso** (scoring, descarte, flujo de descubierta). Lo más reciente arriba. Ver índice y formato en [BITACORA.md](../../BITACORA.md).

> Ojo: el contenido y estado de **cada idea** vive en su propia ficha (`fabrica/ideas/<slug>.md`, frontmatter). Aquí van decisiones sobre **cómo gestionamos las ideas**, no las ideas en sí.

## 2026-06-15 — Recomendaciones según el perfil del dueño (dos corrientes + doble valor)
**Qué:** `discover` y `recommend` ahora leen `fabrica/perfil.md` y proponen ideas en dos corrientes (~50/50): oportunidades generales de alto retorno, y oportunidades alineadas al perfil (intereses/activos) aunque su retorno monetario sea menor. El "retorno" deja de ser solo dinero: incluye oportunidad (alcance/red/posicionamiento), aprendizaje y valor personal. El alcance se abre a cualquier solución tecnológica (app web/mobile, rework, tooling/proyecto de Claude Code, prompt o sistema de prompts, automatización). La ficha suma `tipo_proyecto`, `alineacion_perfil` y `retorno`; el scoring de `new-idea` pondera retorno y encaje.
**Por qué:** El dueño quiere recomendaciones bien alineadas a él —sus intereses, objetivos y activos (p. ej. una audiencia que abre puertas)— sin perder las grandes oportunidades generales. No todo tiene que ser una app ni monetizar fuerte: importa un problema real con buen retorno (monetario o de oportunidad).
**Impacto:** `plugin/skills/{discover,recommend,new-idea,onboarding}/SKILL.md`, `fabrica/perfil.example.md`, `fabrica/ideas/_plantilla-ficha.md`, `fabrica/constitucion.md` (misión), `fabrica/decisiones/registro.yaml` (DR-039), `cockpit/prototype/index.html`.

## 2026-06-14 — Bitácora de ideas creada
**Qué:** Arranca la bitácora de decisiones sobre la base de ideas.
**Por qué:** Parte de la disciplina "documentar todo" de la fábrica — ver [fabrica/bitacora.md](../bitacora.md).
