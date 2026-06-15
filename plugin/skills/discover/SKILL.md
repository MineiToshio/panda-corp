---
description: Busca en internet (Reddit, foros, redes, reviews, tendencias) oportunidades reales —problemas que valga la pena resolver con una solución tecnológica— y las documenta como fichas en la base de ideas. Mezcla dos corrientes —oportunidades generales de alto retorno (independientes del tema) y oportunidades alineadas al perfil del dueño (sus intereses, activos y objetivos). Usar cuando el dueño pida "busca oportunidades", "descubre ideas", "qué podría construir" o similar.
---

# /pandacorp:discover

Discovery de oportunidades. `$ARGUMENTS` puede acotar el nicho (ej: "/pandacorp:discover herramientas para profesores"); sin argumentos, explora amplio guiado por el perfil.

**Alcance abierto.** No se limita a "apps monetizables": una oportunidad puede resolverse con una app web o móvil, una herramienta o tooling de Claude Code, un prompt o sistema de prompts, una automatización, un rework, etc. Lo que importa es **un problema real con buen retorno**.

**El retorno NO es solo dinero.** Cuenta también la **oportunidad** (alcance, contactos, posicionamiento), el aprendizaje y el valor personal. Una idea de monetización modesta puede valer mucho si aprovecha una palanca del dueño o le abre puertas.

## Paso 0 — Lee el perfil

Lee `fabrica/perfil.md` (lo genera `/pandacorp:onboarding`). Extrae intereses, hobbies, gustos/rechazos, objetivos, **activos/palancas** (audiencia, comunidad, red, nicho, skills, datos), apetito de monetización y tipos de proyecto preferidos. Si no existe el perfil, dilo y sugerí correr onboarding; podés continuar solo con la corriente general (abajo) hasta que haya perfil.

## Pasos

1. **Lanza `researcher` en paralelo, en DOS corrientes (apunta a ~50/50):**

   **Corriente A — Oportunidades generales (independientes del tema).** Las mejores del momento por valor/facilidad/retorno, le gusten o no al dueño:
   - Quejas y dolores en Reddit (r/smallbusiness, r/productivity, subreddits de nicho) y foros.
   - Reviews negativas de apps/herramientas existentes (lo que los usuarios piden y nadie da).
   - Tendencias y "alternatives to X" / "tools for Y" (demanda insatisfecha), incluyendo huecos que abrió la IA.

   **Corriente B — Alineadas al perfil.** Ideas que encajan con los intereses/objetivos del dueño **o que aprovechan sus activos/le abren puertas**, aunque el retorno monetario sea menor:
   - Dolores dentro de sus intereses/hobbies/nicho.
   - Ideas que apalancan sus activos (p. ej. si tiene una audiencia o comunidad: algo que esa audiencia usaría, o que potencia su posicionamiento).
   - Herramientas que le resolverían su propia vida/trabajo.

   Cada agente trae oportunidades con **EVIDENCIA** (links a expresiones reales del dolor/demanda), no opiniones de artículos.

2. **Filtra** con criterios Pandacorp: implementable por una persona en semanas (no meses) con los golden paths o como tooling/prompt/automatización; sin requisitos regulatorios pesados (salud, finanzas reguladas); y con **retorno claro** — monetario **o** de oportunidad/valor para el dueño.

3. **Deduplica contra la base existente**: lee los frontmatter de `fabrica/ideas/*.md`; si la oportunidad ya está, agrega la evidencia nueva a esa ficha en vez de duplicar.

4. **Documenta las mejores** (apunta a ~3-5 por corriente) como fichas (`fabrica/ideas/<slug>.md`, formato de `_plantilla-ficha.md`, `origen: discovery`, `estado: documentada`) con score y racional. Completa `tipo_proyecto`, `alineacion_perfil` y `retorno`. Los descartados interesantes: lístalos en el resumen sin crear ficha.

5. **Reporta** en dos bloques —**Generales** y **Alineadas a vos**— cada uno con tabla (título, tipo de proyecto, score, tipo de retorno, dificultad) y tu recomendación. En las alineadas, explicá *por qué* encajan (qué interés/activo aprovechan).

## Reglas
- Evidencia primero: cada ficha lleva ≥2 links a expresiones reales del dolor/demanda.
- No infles scores: un 70+ debe ser genuinamente prometedor (ver rubric en `/pandacorp:new-idea`).
- Honra el doble criterio: NO descartes una idea alineada solo porque su monetización es baja, ni una idea general genial solo porque no es "del tema" del dueño.
- Se ejecuta a demanda hoy; está diseñado para correrse también como job programado (sin interacción humana) — en ese caso solo reporta y registra.
