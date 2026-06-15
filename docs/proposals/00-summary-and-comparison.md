# Pandacorp — Propuestas para la fábrica de software 100% IA

> Generado 2026-06-12 a partir de 4 investigaciones (ver [docs/investigacion/](../investigacion/)).

## El objetivo

Un sistema donde tú aportas **ideas o problemas** ("app para pedir desde la mesa", "tracker de Funkos de One Piece") y la fábrica los investiga, los convierte en especificaciones, decide la arquitectura, crea un proyecto separado y lo implementa con calidad verificada — con intervención humana mínima y explícita.

## Lo que dice la evidencia (síntesis de la investigación)

1. **Spec-driven es el consenso**: los sistemas que funcionan verifican artefactos (PRD, plan, tareas), no conversaciones. La spec es la fuente de verdad; el código se genera y valida contra ella.
2. **El harness importa tanto como el modelo**: el mismo modelo varía ±15 puntos según la orquestación. Invertir en proceso rinde independiente del modelo — exactamente tu requisito de "que funcione bien con cualquier modelo".
3. **Los prompts son sugerencias; los hooks/CI son contratos**: la calidad sin revisión humana se sostiene con gates deterministas (lint, tipos, tests, mutation, SAST) que el modelo no puede auto-aprobar. Los agentes fabrican resultados de tests un 17-22% de las veces — nunca confiar en auto-reporte.
4. **Solo 5 decisiones requieren humano siempre**: producción, dinero, borrado de datos, comunicaciones externas, accesos. El resto se codifica en un registro de decisiones con defaults; cada escalada humana se convierte en regla nueva.
5. **Stacks tipados y populares**: el 94% de los errores de compilación de LLMs son de tipos. TypeScript/Next.js y Python/FastAPI con scaffolds deterministas son los golden paths correctos.

## Las tres propuestas

| | A — Fábrica nativa Claude Code ⭐ | B — Pipeline programático (SDK) | C — Frameworks existentes |
|---|---|---|---|
| Esencia | Skills + subagentes + hooks + plugin distribuible | Orquestador propio en código + CI/CD como gate | Spec Kit + roles BMAD con capa fina propia |
| Esfuerzo de arranque | Días | Semanas | Horas |
| Grado de autonomía | Alto (routines, worktrees, hooks) | Máximo (24/7 en cloud, desatendido) | Medio (diseñados con humano en cada fase) |
| Determinismo | Medio-alto (hooks deterministas, flujo guiado por skills) | Máximo (máquina de estados en código) | Bajo-medio |
| Mantenimiento | Bajo (markdown versionado) | Alto (código propio + SDK que evoluciona) | Delegado, pero personalizar = fork |
| Multi-proyecto | Plugin a nivel usuario + scaffold | API GitHub + plantillas | No resuelto (habría que añadirlo) |
| Riesgo principal | Atado a Claude Code | Sobre-ingeniería prematura; costo API | Pelea contra el grano del framework |
| Detalle | [Propuesta A](01-propuesta-a-fabrica-nativa.md) | [Propuesta B](02-propuesta-b-pipeline-programatico.md) | [Propuesta C](03-propuesta-c-frameworks-existentes.md) |

Los cuatro elementos compartidos (pipeline de 10 fases, modelo de decisión humana, roles de agentes, safeguards y golden paths) están en [Elementos comunes](04-elementos-comunes.md) — aplican a cualquier propuesta.

## Recomendación

**Empezar con la Propuesta A**, robando las mejores plantillas de C (prompts de roles BMAD, formatos de spec de Spec Kit), y **evolucionar hacia B por etapas**: cuando una fase del pipeline se vuelva repetitiva y estable en A (p. ej. el scaffold o la verificación), congelarla como código/CI al estilo B. Razones:

1. Tu requisito dominante es **velocidad para validar el sistema con casos reales** (Funkos, restaurantes) — A entrega un pipeline funcional en días.
2. A genera, como subproducto, todo lo que B necesitaría después (prompts depurados, checklists, plantillas, registro de decisiones). B primero sería apostar semanas a un diseño sin feedback.
3. Los safeguards críticos (hooks, branch protection, CI de 5 gates) son idénticos en A y B — no se pierde seguridad por empezar simple.

## Qué decidir ahora (gate H1 de este propio proyecto 🙂)

1. **¿Propuesta A como punto de partida?** (o prefieres B o C)
2. **¿Los dos gates humanos propuestos te bastan?** (H1 go/no-go de ideas, H2 producción/dinero/externo)
3. **¿Apruebas los 4 golden paths** y la infraestructura por defecto (Vercel/Railway/Supabase/GitHub)?
4. **¿Idioma de los artefactos?** (propongo: documentos de producto en español, código y commits en inglés)
5. **¿Primer piloto?** (propongo el Funko tracker: ejercita investigación de fuentes en tiempo real, scraping, notificaciones y web — cubre los stacks D + A)

Con esas respuestas, el siguiente paso es construir la fase 1 de la Propuesta A: constitución, CLAUDE.md de la fábrica, registro de decisiones y los primeros agentes/skills.
