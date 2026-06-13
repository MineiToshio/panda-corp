# Pandacorp — Visión y flujo de trabajo (v0.2)

> Ideas de Sergio ordenadas y validadas con sus respuestas del 2026-06-12.

## Propósito (doble)

1. **Generar ingresos**: descubrir e implementar aplicaciones monetizables. No se busca solo "el gran hit": un portfolio de apps pequeñas que generen poquito cada una suma un ingreso regular.
2. **Facilitar la vida de Sergio**: aplicaciones que resuelven problemas propios. La monetización es irrelevante; el valor es personal.

## Contexto operativo

- **Operación de una sola persona**: Sergio dirige, la IA hace todo. Proceso inspirado en el flujo 89.ia (PRD, FRD, blueprint, work orders) pero simplificado — sin la ceremonia de un equipo.
- **Debilidad declarada en UX/UI**: la fábrica la compensa con esfuerzo dedicado en diseño (ver Refuerzo UX/UI).
- **Claude es el orquestador principal** de todo el sistema.

## Modelo operativo: fábrica = sistema operativo, proyectos = contenedores ✅ DECIDIDO

La fábrica **se encarga de todo** (investigar, diseñar, arquitectar, programar, iterar) pero **nada del producto vive en panda-corp**:

- El know-how (agentes, skills, hooks, estándares, plantillas) se empaqueta como **plugin de Claude Code** disponible en cualquier carpeta.
- En `panda-corp/` solo viven: el know-how, la **base de ideas**, y el **portfolio** (índice del estado de cada producto). Aquí ocurren las fases 0-1 (discovery y selección).
- Al seleccionarse una idea, `/pandacorp:scaffold` crea la carpeta/repo del proyecto, y **todas las fases siguientes (2-9) se ejecutan dentro del proyecto**, en sesiones que corren ahí con los agentes de la fábrica.
- **Iteraciones / ampliar scope (v2, v3…)**: se corre `/pandacorp:nueva-version` dentro del proyecto → re-entra al pipeline en fase 2 (producto) y genera nuevos FRDs y work orders en el mismo repo. Siempre se continúa en el proyecto; la fábrica solo refleja el estado en el portfolio.
- **Sincronización**: cada proyecto declara su estado en `docs/estado.yaml`; el portfolio de la fábrica se actualiza por skill a demanda o job diario.

### Referencias cruzadas fábrica ↔ proyecto ✅ DECIDIDO

Regla de oro: **cada dato vive en un solo lugar; el otro lado guarda solo un puntero**. El scaffold crea ambos enlaces automáticamente en el handoff:

- **Fábrica → proyecto** (`fabrica/portfolio.md`): entrada por proyecto con `ruta` local, `repo`, `idea-origen` y `estado` resumido. La ficha de idea se "congela" al handoff (`estado: en-pipeline` + link al proyecto); deja de documentarse ahí.
- **Proyecto → fábrica** (sección fija "Origen — Pandacorp" en el `CLAUDE.md` del proyecto): ruta de la fábrica, link a la ficha de idea original, y la aclaración explícita de que estándares/proceso vienen del plugin y que TODA la documentación del producto (PRD, FRDs, diseño, blueprint, work orders) vive en el `docs/` del proyecto, nunca en la fábrica.
- **Independencia**: el proyecto nunca *necesita* leer la fábrica para trabajar (estándares vía plugin, artefactos en su `docs/`). El puntero es informativo, no una dependencia.
- **Sincronización pull**: la fábrica lee el `docs/estado.yaml` de cada proyecto siguiendo los punteros del portfolio (skill `/actualizar-portfolio` o job diario). Ruta rota (carpeta movida) → el job lo detecta y pregunta, nunca queda silenciosamente desactualizado.

## Las dos fuentes de ideas

| Fuente | Cómo entra | Quién define |
|---|---|---|
| **1. Ideas propias** | Sergio llega con el problema/funcionalidad y una guía | Sergio dirige; la fábrica formaliza |
| **2. Discovery automático** | Skill a demanda hoy (`/descubrir`); luego cron/routine periódico | La fábrica busca en internet, Reddit, foros, redes: dolores reales, fáciles de implementar y monetizables, y los documenta |

**Alcance del discovery ✅ DECIDIDO**: explora todos los perfiles (micro-SaaS global, mercado hispano, pago único/extensiones…); el scoring decide. Sin restricción inicial.

## La base de ideas ✅ DECIDIDO: markdown (visor = el cockpit)

> Aclaración (2026-06-13): la base de ideas son **archivos markdown** (fuente de verdad, en git, leídos/escritos por los agentes). El **visor e interacción es el cockpit**, no Obsidian. Obsidian se descartó por redundante (era solo un visor provisional). Mover una tarjeta para cambiar el estado se hace en el cockpit (escribe el frontmatter del .md directamente, sin llamar a Claude).

- Cada idea/dolor es una ficha `.md` en `fabrica/ideas/` con frontmatter:
  ```yaml
  ---
  titulo: Tracker de Funkos One Piece
  tipo: personal | monetizable | ambas
  origen: sergio | discovery
  estado: descubierta | documentada | recomendada | seleccionada | en-pipeline | lanzada | descartada
  score: 0-100
  evidencia: [links]
  ---
  ```
- **Vista kanban**: el cockpit muestra las fichas como tablero tipo Trello agrupado por `estado`; mover una tarjeta reescribe `estado:` en el .md. (Obsidian queda como opción personal de Sergio si algún día la quiere, pero no es parte del sistema.)
- **Trigger**: un job (diario al inicio; luego watcher/routine) detecta cambios de `estado:` y dispara la fase correspondiente — ej. `seleccionada` → arranca scaffold + fase de producto.
- Dinámica de selección: Sergio consulta ("¿cuáles me recomiendas?"), la fábrica responde con ranking justificado, **Sergio decide** (Gate humano #1).

## El pipeline

```
   EN PANDA-CORP (fábrica)         — etapa de la idea: DESCUBIERTA
0. DISCOVERY / INTAKE   → ficha de idea en la base (/discover, /new-idea)
1. SELECCIÓN            → Sergio decide ejecutar el handoff             ← GATE HUMANO
   ─── /pandacorp:spec <idea>  (HANDOFF: nace la carpeta/repo + documenta) ───
   EN EL PROYECTO (con los agentes de la fábrica)
2. PRODUCTO  → investigación + PRD + FRDs del MVP        → etapa DOCUMENTADA
3. DISEÑO    → investigación visual + mockups navegables → etapa DISEÑO
              → revisión visual de Sergio (iterando en la conversación) ← GATE LIGERO
4. ARQUITECTURA → /blueprint: stack, modelo de datos, ADRs + work orders → etapa ARQUITECTURA
5. CONSTRUCCIÓN → /implement: Agent Teams construyen todo, en vivo en   → etapa EN CONSTRUCCIÓN
                  Mission Control, TDD, testing por FRD/hito
6. RELEASE v1   → /release: auditoría + deploy a producción            ← GATE HUMANO  → etapa LANZADA
7. ITERACIÓN    → /iterate: agregar funcionalidad/cambio en cualquier momento
                  (en construcción o lanzado). /new-version solo para hitos grandes.
```

Notas: las etapas del tablero del cockpit son DESCUBIERTA → DOCUMENTADA → DISEÑO → ARQUITECTURA → EN CONSTRUCCIÓN → LANZADA (+ DESCARTADA). Cada transición la escribe el skill correspondiente. El handoff (idea en la fábrica → proyecto en su propia carpeta) ocurre en `/pandacorp:spec`; por eso ese skill lleva el nombre de la idea y los demás no (corren dentro del proyecto). "Recomendada" se eliminó; `recommend` es una acción de consejo a demanda.

Cada fase produce artefactos versionados en `docs/` del proyecto. Las pruebas se hacen al cerrar cada FRD/hito, no al final.

## Refuerzo UX/UI (prioridad explícita)

- **Agente diseñador dedicado** + investigación visual por proyecto: referencias de apps similares bien diseñadas, patrones probados, heurísticas de usabilidad.
- **Sistema de diseño estándar** (shadcn/ui + tokens) como base — no inventar desde cero.
- **Mockups navegables antes de codear** (HTML estático o Claude Design — por investigar), para que el gate de Sergio sea solo mirar y opinar.
- **Verificación automatizada**: screenshots por viewport (Playwright), checks de accesibilidad y responsive en el testing.

## Interfaz gráfica ✅ DECIDIDO: el "Pandacorp Cockpit" (primer proyecto)

- Dashboard web **local y solo-lectura** (`/Users/Shared/Proyectos/pandacorp-cockpit/`, ver su `PLAN.md`). NUNCA llama a Claude: lee los archivos del repo.
- Paneles: (1) kanban de ideas (mover tarjeta reescribe `estado:`), (2) portfolio, (3) "siguiente comando a copiar" según estado/fase, (4) Mission Control (Agent Teams en vivo, leyendo `~/.claude/dashboard-events.ndjson`).
- Sergio ejecuta los comandos pegándolos en la app de Claude Code → todo sale de su suscripción Max (no del pool headless).
- Se construye con `/loop` (sesión interactiva = suscripción). Reemplaza a Obsidian como visor. Propuesta detallada: [docs/propuestas/05-interfaz-cockpit.md](../propuestas/05-interfaz-cockpit.md).

## Preguntas aún abiertas (secundarias)

- Idioma de artefactos (propuesta: docs en español, código/commits en inglés)
- Presupuesto mensual máximo de infraestructura del portfolio
- Máximo de proyectos en paralelo
- Cuentas: GitHub, Vercel/Railway, Stripe, dominio Pandacorp
- Criterio de apagado de apps sin tracción

## Decisiones técnicas resueltas por investigación (2026-06-12)

- **Mockups ✅**: HTML autocontenidos generados por Claude Code (3 direcciones en paralelo) sobre sistema de diseño shadcn/ui + `design-tokens.json` (tweakcn); screenshots Playwright + chequeo de accesibilidad axe-core antes del gate visual. Claude Design queda como herramienta manual opcional (no tiene API). Ver [investigación 05](../investigacion/05-mockups-y-fase-diseno.md).
- **Kanban ✅ (en el cockpit, NO Obsidian)**: el tablero vive en el cockpit; arrastrar/mover una tarjeta reescribe `estado:` en el .md directamente. Obsidian descartado por redundante. La investigación 06 (Obsidian) queda como referencia histórica.
- **Plugin ✅**: `panda-corp/plugin/` + symlink a `~/.claude/skills/pandacorp` — auto-carga en cualquier carpeta, ediciones en vivo, skills namespaced (`/pandacorp:*`), plantillas accesibles vía `${CLAUDE_PLUGIN_ROOT}/templates/`. Ver [investigación 07](../investigacion/07-estructura-plugin-pandacorp.md).

## Equipos de agentes y Mission Control ✅ DECIDIDO (a validar en uso)

- **Implementación con Agent Teams**: la fase de implementación usa un equipo de agentes que se comunican entre sí (peer-to-peer) y se pasan el trabajo, en vez de agentes sueltos secuenciales: investigador → backend → frontend → testing, con dependencias (frontend arranca cuando backend termina; testing cuando frontend termina) y mensajes directos. Corre dentro de la sesión interactiva → usa la suscripción Max (no el pool headless).
- **Mission Control en el cockpit**: un panel de solo-lectura que muestra en vivo qué agente está activo, su tarea, los mensajes entre ellos y el grafo de dependencias. Se alimenta de eventos que los hooks (`TaskCreated/TaskCompleted/TeammateIdle/SubagentStop/PostToolUse`) escriben en un archivo local; el dashboard solo lee → cero llamadas a Claude. Observa, no controla (para redirigir/pausar, se salta a la terminal). Referencia/atajo existente: `claude-view`.
- **Caveat token burn**: 3-5 agentes en paralelo consumen ~4-5x la cuota. Recomendado Max 20x para uso consistente; mitigar con agentes obreros en sonnet/haiku y líder en opus. Tamaño de equipo recomendado: 3-5.
- **Caveat experimental**: Agent Teams es experimental (sin resume de sesión, el estado de tareas puede rezagarse). Escribir el contexto crítico entre agentes a archivos, no solo a mensajes.

## Próxima etapa propuesta

**Construcción fase 1**: estructura del plugin + constitución + CLAUDE.md de la fábrica + base de ideas con `ideas.base` + primeros skills (`/descubrir`, `/nueva-idea`, `/recomendar`). Luego **piloto** con una idea real de Sergio.
