---
description: Busca en internet (Reddit, foros, redes, reviews) dolores reales de personas que sean fáciles de implementar y monetizables, y los documenta como fichas en la base de ideas de Pandacorp. Usar cuando Sergio pida "busca oportunidades", "descubre ideas" o similar.
---

# /pandacorp:discover

Discovery de oportunidades. `$ARGUMENTS` puede acotar el nicho (ej: "/pandacorp:discover herramientas para profesores"); sin argumentos, explora amplio.

## Pasos

1. **Lanza 3-4 agentes `researcher` en paralelo**, cada uno con un ángulo distinto:
   - Quejas y dolores en Reddit (r/smallbusiness, r/productivity, subreddits del nicho) y foros especializados
   - Reviews negativas de apps existentes (qué piden los usuarios que nadie da)
   - Comunidades hispanas (dolores locales menos atendidos)
   - Tendencias de búsqueda y "alternatives to X" (demanda insatisfecha)
   Cada agente debe traer dolores con EVIDENCIA (links a posts reales), no opiniones de artículos.
2. **Filtra** con criterios Pandacorp: implementable con golden paths A/B/C/D por una persona en semanas (no meses), vía de monetización clara O alto valor personal, sin requisitos regulatorios pesados (salud, finanzas reguladas).
3. **Deduplica contra la base existente**: lee los frontmatter de `fabrica/ideas/*.md`; si el dolor ya está, agrega la evidencia nueva a esa ficha.
4. **Documenta los 3-5 mejores** como fichas (`fabrica/ideas/<slug>.md`, formato de `_plantilla-ficha.md`, `origen: discovery`, `estado: documentada`) con score y racional. Los descartados interesantes: lístalos en el resumen sin crear ficha.
5. **Reporta**: tabla con las fichas creadas (título, score, monetización, dificultad) + ranking con tu recomendación.

## Reglas
- Evidencia primero: cada ficha lleva ≥2 links a expresiones reales del dolor.
- No infles scores: un 70+ debe ser genuinamente prometedor.
- Este skill se ejecuta a demanda hoy; está diseñado para correrse también como job programado (sin interacción humana).
