---
title: "El plugin"
group: concepts
order: 11
---

# El plugin

El plugin `pandacorp` es el corazón operativo de la fábrica. Contiene todas las habilidades (`/pandacorp:*`) y los agentes especializados que ejecutan el trabajo. Vive en `panda-corp/plugin/` y se instala localmente en Claude Code.

## Estructura del plugin

```
plugin/
  .claude-plugin/
    plugin.json          ← versión semántica + metadatos
  skills/
    <slug>/
      SKILL.md           ← definición de la habilidad
  agents/
    <id>.md              ← definición del agente
  docs/
    decision-log.md      ← historial de cambios del plugin
```

## Las habilidades (`/pandacorp:*`)

Cada habilidad vive en `plugin/skills/<slug>/SKILL.md` y se invoca como `/pandacorp:<slug>`. El prefijo `pandacorp:` es automático — nunca se incluye en el nombre de la carpeta.

Las habilidades principales del ciclo de vida:

| Habilidad | Cuándo ejecutarla |
|---|---|
| `/pandacorp:onboarding` | Primera configuración de la fábrica |
| `/pandacorp:explore` | Explorar una idea difusa en conversación |
| `/pandacorp:new-idea` | Cristalizar una idea en una tarjeta |
| `/pandacorp:spec` | Crear el proyecto y documentar el MVP |
| `/pandacorp:design` | Mockups y sistema de diseño |
| `/pandacorp:blueprint` | Arquitectura + work orders |
| `/pandacorp:implement` | Construcción autónoma |
| `/pandacorp:iterate` | Añadir features o cambiar comportamientos |
| `/pandacorp:release` | Auditoría + plan de lanzamiento |
| `/pandacorp:review-launch` | Métricas post-lanzamiento |
| `/pandacorp:bug` | Reportar un bug encontrado en pruebas |
| `/pandacorp:decide` | Registrar una decisión pendiente |
| `/pandacorp:memory` | Gestionar la memoria transversal (cosechar / revisar) |
| `/pandacorp:learn` | Promover una lección a estándar / regla / skill |

## Versioning semántico

El plugin sigue semver (`x.y.z`):

- **PATCH** — fix o ajuste sin cambio de comportamiento.
- **MINOR** — nueva habilidad o agente compatible.
- **MAJOR** — cambio incompatible (renombrar/eliminar una habilidad, cambiar un flujo).

La versión vive en `plugin/.claude-plugin/plugin.json` — es la fuente de verdad. Cada cambio en `plugin/` debe bumpar la versión y registrar el motivo en `plugin/docs/decision-log.md`.

## Instalación y actualización

```bash
# Instalar desde el repo local
claude plugin install pandacorp@panda-corp

# Actualizar tras cambios en plugin/
claude plugin update pandacorp@panda-corp
```

Los cambios aplicados tras la instalación se activan en la siguiente sesión de Claude Code.

## Drift del plugin

Mission Control detecta cuando el plugin instalado está desfasado respecto al código del repo (SHA instalado ≠ SHA del último commit en `plugin/`). Muestra un banner con el comando de actualización para que no se pase por alto.

## El plugin no viaja con el proyecto

El plugin es de la fábrica, no de los proyectos. Un clon solo del proyecto (`<proyecto>/`) no tiene el plugin — para operarlo se necesita el repo de la fábrica con el plugin instalado. Los proyectos son totalmente funcionales sin el plugin (pueden desarrollarse con `AGENTS.md` como guía), pero las habilidades `/pandacorp:*` no estarán disponibles.
