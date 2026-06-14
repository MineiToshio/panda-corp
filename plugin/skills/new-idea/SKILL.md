---
description: Captura una idea o problema de Sergio en la base de ideas de Pandacorp. Usar cuando Sergio describe una app que quiere, un problema que tiene, dice "tengo una idea", o pide convertir lo conversado en una propuesta para el tablero. Sintetiza la idea desde toda la conversación, la investiga ligero y le asigna score. Es también el cristalizador de /pandacorp:explore.
---

# /pandacorp:new-idea

Cristaliza una idea como ficha en la base de ideas. La idea puede venir de `$ARGUMENTS`, de una descripción puntual, o de **toda una conversación de descubierta** (ej. tras `/pandacorp:explore`).

## Pasos

1. **Sintetiza desde la conversación completa.** No te quedes solo con `$ARGUMENTS` ni con el último mensaje: recorre **toda** la conversación hacia atrás y reconstruye la idea con lo que se dijo, se rebatió y se concluyó. Reglas según lo que encuentres:
   - Si la conversación exploró **varias** ideas candidatas, lístalas en una línea cada una y confirma con Sergio cuál(es) capturar (puedes crear una ficha por cada una).
   - Si solo hay una descripción corta y poco contexto, haz máximo 2-3 preguntas para lo esencial que falte (¿qué duele exactamente? ¿es para él o para vender? ¿qué imagina como solución?). Si ya alcanza, no preguntes.
2. **Ubica la fábrica**: la base de ideas está en `/Users/Shared/Proyectos/panda-corp/fabrica/ideas/`. Lee `_plantilla-ficha.md` para el formato exacto.
3. **Investigación ligera** (delega al agente `researcher`, una pasada rápida): ¿existen soluciones? ¿hay evidencia del dolor en otros? ¿viabilidad técnica obvia? Si la conversación de descubierta ya trajo evidencia, reúsala en vez de repetir la búsqueda. No es la investigación profunda — eso viene en fase de producto.
4. **Score (0-100)**: dolor real y frecuente (30%), facilidad de implementación con golden paths (25%), potencial de monetización o valor personal (25%), ventaja/diferenciación (20%). Documenta el racional en "Notas de evaluación".
5. **Crea la ficha** `fabrica/ideas/<slug-en-ingles>.md` con frontmatter completo, `estado: documentada`, `creada:` con fecha de hoy.
6. Reporta a Sergio: resumen de la ficha, score y si la recomiendas o no (con porqué corto).

## Reglas
- Una ficha por idea; si ya existe una similar (lee los frontmatter), actualízala en vez de duplicar.
- Tipo `personal` también se documenta con rigor — el score pondera valor personal en vez de monetización.
- Para explorar y aclarar una idea difusa ANTES de capturarla, ese es el trabajo de `/pandacorp:explore`; este skill es el paso de cristalizar.
