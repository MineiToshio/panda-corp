---
description: Analiza la base de ideas de Pandacorp y recomienda a Sergio cuáles avanzar, con ranking justificado. Usar cuando Sergio pregunte "¿cuáles me recomiendas?", "¿qué construimos?", o quiera revisar el estado de sus ideas.
---

# /pandacorp:recommend

Ranking y recomendación sobre la base de ideas.

## Pasos

1. Lee todas las fichas de `/Users/Shared/Proyectos/panda-corp/fabrica/ideas/` (frontmatter + notas de evaluación). Ignora `_plantilla-ficha.md` y estados `descartada`/`lanzada`/`en-pipeline`.
2. **Revalida scores si están viejos** (creada hace >60 días o evidencia débil): pasa rápida del `researcher` para confirmar que el dolor sigue vigente.
3. Construye el ranking considerando además del score: balance del portfolio (mezclar monetizables con personales; no 3 scrapers a la vez), esfuerzo disponible (proyectos ya en pipeline — revisa `fabrica/portfolio.md`), y quick wins (alto valor / baja dificultad primero).
4. Presenta a Sergio: top 3-5 con — por cada una — qué es (1 línea), por qué ahora, score y dificultad, y qué validaría la v1. Más una línea de "cuáles NO y por qué".
5. **La decisión es de Sergio** (gate humano #1). Cuando elija: actualiza `estado: seleccionada` en las fichas elegidas y dile que el siguiente paso es `/pandacorp:scaffold <idea>` (o que mueva la tarjeta en Obsidian — el efecto es el mismo).

## Reglas
- Máximo 5 recomendadas; elegir es lo que cuesta, no listar.
- Sé directo en la recomendación #1: "yo empezaría por X porque Y".
