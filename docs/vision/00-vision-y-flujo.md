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

## La base de ideas ✅ DECIDIDO: markdown + Obsidian

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
- **Vista kanban**: panda-corp se abre como vault de Obsidian; las Bases de Obsidian (o el plugin Kanban) dan la vista tipo Trello sobre el frontmatter. Mover una tarjeta = cambiar `estado:` en el archivo.
- **Trigger**: un job (diario al inicio; luego watcher/routine) detecta cambios de `estado:` y dispara la fase correspondiente — ej. `seleccionada` → arranca scaffold + fase de producto.
- Dinámica de selección: Sergio consulta ("¿cuáles me recomiendas?"), la fábrica responde con ranking justificado, **Sergio decide** (Gate humano #1).

## El pipeline

```
   EN PANDA-CORP (fábrica)
0. DISCOVERY / INTAKE   → ficha de idea en la base
1. SELECCIÓN            → Sergio elige (mueve la tarjeta)            ← GATE HUMANO
   ──────────── scaffold: nace la carpeta/repo del proyecto ────────────
   EN EL PROYECTO (con los agentes de la fábrica)
2. PRODUCTO             → investigación mercado/competidores
                          → PRD (visión, usuarios, monetización)
                          → FRDs (funcionalidades + criterios de aceptación)
3. DISEÑO UX/UI         → investigación visual + mockups navegables
                          → revisión visual de Sergio                 ← GATE LIGERO
4. ARQUITECTURA         → Blueprint: stack (golden path), modelo de datos, ADRs
5. WORK ORDERS          → órdenes de trabajo implementables y verificables
6. IMPLEMENTACIÓN       → por work order, TDD, testing al cerrar cada FRD/hito
7. RELEASE v1           → deploy a producción                         ← GATE HUMANO
8. ITERACIÓN            → /nueva-version re-entra en fase 2; operación continua
```

Cada fase produce artefactos versionados en `docs/` del proyecto. Las pruebas se hacen al cerrar cada FRD/hito, no al final.

## Refuerzo UX/UI (prioridad explícita)

- **Agente diseñador dedicado** + investigación visual por proyecto: referencias de apps similares bien diseñadas, patrones probados, heurísticas de usabilidad.
- **Sistema de diseño estándar** (shadcn/ui + tokens) como base — no inventar desde cero.
- **Mockups navegables antes de codear** (HTML estático o Claude Design — por investigar), para que el gate de Sergio sea solo mirar y opinar.
- **Verificación automatizada**: screenshots por viewport (Playwright), checks de accesibilidad y responsive en el testing.

## Interfaz gráfica ✅ DECIDIDO: después, como producto interno

- Día 1: markdown + skills + Obsidian como vista.
- La GUI web (dashboard del portfolio, conectada a GitHub, con acciones tipo "crear repo") se construye más adelante **pasando por el propio pipeline** — primer producto interno de la fábrica y validación del sistema completo.

## Preguntas aún abiertas (secundarias)

- Idioma de artefactos (propuesta: docs en español, código/commits en inglés)
- Presupuesto mensual máximo de infraestructura del portfolio
- Máximo de proyectos en paralelo
- Cuentas: GitHub, Vercel/Railway, Stripe, dominio Pandacorp
- Criterio de apagado de apps sin tracción

## Decisiones técnicas resueltas por investigación (2026-06-12)

- **Mockups ✅**: HTML autocontenidos generados por Claude Code (3 direcciones en paralelo) sobre sistema de diseño shadcn/ui + `design-tokens.json` (tweakcn); screenshots Playwright + chequeo de accesibilidad axe-core antes del gate visual. Claude Design queda como herramienta manual opcional (no tiene API). Ver [investigación 05](../investigacion/05-mockups-y-fase-diseno.md).
- **Kanban Obsidian ✅**: plugin **Bases Kanban** (ewerx) sobre Bases nativas — arrastrar tarjeta escribe `estado:` en el frontmatter del .md. Detección: escaneo periódico con caché (+ git diff como evolución). Ver [investigación 06](../investigacion/06-kanban-obsidian.md).
- **Plugin ✅**: `panda-corp/plugin/` + symlink a `~/.claude/skills/pandacorp` — auto-carga en cualquier carpeta, ediciones en vivo, skills namespaced (`/pandacorp:*`), plantillas accesibles vía `${CLAUDE_PLUGIN_ROOT}/templates/`. Ver [investigación 07](../investigacion/07-estructura-plugin-pandacorp.md).

## Equipos de agentes y Mission Control ✅ DECIDIDO (a validar en uso)

- **Implementación con Agent Teams**: la fase de implementación usa un equipo de agentes que se comunican entre sí (peer-to-peer) y se pasan el trabajo, en vez de agentes sueltos secuenciales: investigador → backend → frontend → testing, con dependencias (frontend arranca cuando backend termina; testing cuando frontend termina) y mensajes directos. Corre dentro de la sesión interactiva → usa la suscripción Max (no el pool headless).
- **Mission Control en el cockpit**: un panel de solo-lectura que muestra en vivo qué agente está activo, su tarea, los mensajes entre ellos y el grafo de dependencias. Se alimenta de eventos que los hooks (`TaskCreated/TaskCompleted/TeammateIdle/SubagentStop/PostToolUse`) escriben en un archivo local; el dashboard solo lee → cero llamadas a Claude. Observa, no controla (para redirigir/pausar, se salta a la terminal). Referencia/atajo existente: `claude-view`.
- **Caveat token burn**: 3-5 agentes en paralelo consumen ~4-5x la cuota. Recomendado Max 20x para uso consistente; mitigar con agentes obreros en sonnet/haiku y líder en opus. Tamaño de equipo recomendado: 3-5.
- **Caveat experimental**: Agent Teams es experimental (sin resume de sesión, el estado de tareas puede rezagarse). Escribir el contexto crítico entre agentes a archivos, no solo a mensajes.

## Próxima etapa propuesta

**Construcción fase 1**: estructura del plugin + constitución + CLAUDE.md de la fábrica + base de ideas con `ideas.base` + primeros skills (`/descubrir`, `/nueva-idea`, `/recomendar`). Luego **piloto** con una idea real de Sergio.
