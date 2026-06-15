---
description: Analiza la base de ideas de Pandacorp y recomienda al dueño cuáles avanzar, con ranking justificado. Usar cuando el dueño pregunte "¿cuáles me recomiendas?", "¿qué construimos?", o quiera revisar el estado de sus ideas.
---

# /pandacorp:recommend

Ranking y recomendación sobre la base de ideas.

## Pasos

1. Lee todas las fichas de `fabrica/ideas/` (en la raíz de la fábrica; frontmatter + notas de evaluación). Ignora `_plantilla-ficha.md` y estados `descartada`/`lanzada`/`en-pipeline`.
2. **Revalida scores si están viejos** (creada hace >60 días o evidencia débil): pasa rápida del `researcher` para confirmar que el dolor sigue vigente.
3. Construye el ranking considerando además del score: balance del portfolio (mezclar monetizables con personales; no 3 scrapers a la vez), esfuerzo disponible (proyectos ya en pipeline — revisa `fabrica/portfolio.md`), y quick wins (alto valor / baja dificultad primero).
4. Presenta al dueño: top 3-5 con — por cada una — qué es (1 línea), por qué ahora, score y dificultad, y qué validaría la v1. Más una línea de "cuáles NO y por qué".
5. Marca `estado: recomendada` en tus elecciones (top picks); las demás quedan en `documentada`. **La selección final es del dueño** (gate humano #1) y se expresa ejecutando `/pandacorp:scaffold <idea>` sobre la que quiera (eso la mueve a `en-pipeline`). Las que no quiera, las descarta desde el cockpit (→ `descartada`). El tablero del cockpit es solo-lectura: refleja estos estados, no se mueve a mano.

## Reglas
- Máximo 5 recomendadas; elegir es lo que cuesta, no listar.
- Sé directo en la recomendación #1: "yo empezaría por X porque Y".
