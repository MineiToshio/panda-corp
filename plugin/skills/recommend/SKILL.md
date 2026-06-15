---
description: Analiza la base de ideas de Pandacorp y recomienda al dueño cuáles avanzar, con ranking justificado y alineado a su perfil (intereses, activos, objetivos) y al doble valor (retorno monetario o de oportunidad). Usar cuando el dueño pregunte "¿cuáles me recomiendas?", "¿qué construimos?", o quiera revisar el estado de sus ideas.
---

# /pandacorp:recommend

Ranking y recomendación sobre la base de ideas.

## Paso 0 — Lee el perfil

Lee `factory/profile.md`: intereses, objetivos, **activos/palancas** (audiencia, comunidad, red, nicho, skills), apetito de monetización y tipos de proyecto preferidos. El ranking se justifica contra esto. Si no existe el perfil, recomendá correr `/pandacorp:onboarding` y rankea solo por valor general mientras tanto.

## Pasos

1. Lee todas las fichas de `factory/ideas/` (en la raíz de la fábrica; frontmatter + notas de evaluación). Ignora `_idea-template.md` y estados `descartada`/`lanzada`/`en-pipeline`.
2. **Revalida scores si están viejos** (creada hace >60 días o evidencia débil): pasa rápida del `researcher` para confirmar que la oportunidad sigue vigente.
3. Construye el ranking considerando, además del score: **alineación con el perfil**, **tipo de retorno** (monetario, de oportunidad —alcance/red/posicionamiento— o personal; pondéralo según el apetito del dueño), balance del portfolio (mezclar; no 3 scrapers a la vez), esfuerzo disponible (proyectos ya en pipeline — revisa `factory/portfolio.md`) y quick wins (alto valor / baja dificultad primero).
4. **Presenta en dos bloques** para que el dueño vea ambas lógicas:
   - **Mejores apuestas (valor general)** — las más prometedoras por retorno/facilidad, independientemente del tema.
   - **Alineadas a vos** — las que encajan con tus intereses o **aprovechan tus activos / te abren puertas**, aunque su retorno monetario sea menor; explicá *por qué* encajan.
   Por cada una: qué es (1 línea), tipo de proyecto, por qué ahora, score, tipo de retorno y dificultad, y qué validaría la v1. Cierra con "cuáles NO y por qué".
5. Marca `estado: recomendada` en tus elecciones (top picks de ambos bloques); las demás quedan en `documentada`. **La selección final es del dueño** (gate humano #1) y se expresa ejecutando `/pandacorp:scaffold <idea>` sobre la que quiera (eso la mueve a `en-pipeline`). Las que no quiera, las descarta desde Mission Control (→ `descartada`). El tablero de Mission Control es solo-lectura: refleja estos estados, no se mueve a mano.

## Reglas
- Máximo ~5 recomendadas en total; elegir es lo que cuesta, no listar.
- Sé directo en la recomendación #1: "yo empezaría por X porque Y".
- No castigues una idea alineada por bajo retorno monetario si abre puertas o apalanca un activo; ni una idea general por no ser "del tema" del dueño. Ambas lógicas conviven.
