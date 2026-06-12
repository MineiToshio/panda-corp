---
description: Captura una idea o problema de Sergio en la base de ideas de Pandacorp. Usar cuando Sergio describe una app que quiere, un problema que tiene, o dice "tengo una idea". Crea la ficha, la investiga ligero y le asigna score.
---

# /pandacorp:new-idea

Captura la idea descrita en `$ARGUMENTS` (o en la conversación) como ficha en la base de ideas.

## Pasos

1. **Ubica la fábrica**: la base de ideas está en `/Users/Shared/Proyectos/panda-corp/fabrica/ideas/`. Lee `_plantilla-ficha.md` para el formato exacto.
2. **Entrevista mínima**: si falta información esencial (¿qué duele exactamente? ¿es para él o para vender? ¿qué imagina como solución?), haz máximo 2-3 preguntas. Si la descripción ya alcanza, no preguntes.
3. **Investigación ligera** (delega al agente `researcher`, una pasada rápida): ¿existen soluciones? ¿hay evidencia del dolor en otros? ¿viabilidad técnica obvia? No es la investigación profunda — eso viene en fase de producto.
4. **Score (0-100)**: dolor real y frecuente (30%), facilidad de implementación con golden paths (25%), potencial de monetización o valor personal (25%), ventaja/diferenciación (20%). Documenta el racional en "Notas de evaluación".
5. **Crea la ficha** `fabrica/ideas/<slug-en-ingles>.md` con frontmatter completo, `estado: documentada`, `creada:` con fecha de hoy.
6. Reporta a Sergio: resumen de la ficha, score y si la recomiendas o no (con porqué corto).

## Reglas
- Una ficha por idea; si ya existe una similar, actualízala en vez de duplicar.
- Tipo `personal` también se documenta con rigor — el score pondera valor personal en vez de monetización.
