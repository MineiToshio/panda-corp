# Brief — Rediseño de la vista "Party" de Mission Control (fiel + RPG)

> Documento de traspaso para una conversación nueva. Tiene TODO el contexto del problema y los objetivos.
> Interacción siempre en **español**. Esto es diseño en `prototype/` primero — NO se toca el código de producto todavía.

## 1. Qué es esto

- **Pandacorp** es una fábrica de software 100% IA (el repo `panda-corp/` es la fábrica: skills, agentes, estándares).
- **Mission Control (MC)** es su dashboard propio (Next.js 16 / React 19 / Tailwind 4), vive DENTRO del repo en `panda-corp/mission-control/`. Se está construyendo dogfooding la propia fábrica.
- La vista **Party** (FRD-06) es un panel RPG por proyecto: muestra a los "agentes" construyendo la app como una "party" de aventureros en un mapa pixel-art. Es lo que más ilusiona al owner.

## 2. El problema (por qué este rediseño)

La vista Party **no refleja la realidad** — es una maqueta portada del prototipo:

- En `mission-control/app/projects/[slug]/_party/layout.ts` hay un **elenco fijo de roles** (`MCROSTER` + el tipo `Role`): `researcher`, `backend-dev`, `frontend-dev`, `test-writer`, `reviewer`, `designer`, `architect`, `security-auditor`, `product-manager`, `guild` (~10 roles). Por modo muestra 6 sprites fijos.
- Pero el **motor de build real** (`pandacorp-build.js`) emite eventos `AgentWorking {role, wo}` a `~/.claude/dashboard-events.ndjson`, y el rol que emite es **`implementer`** (un generalista full-stack, uno por work order) + **`reviewer`** (uno por FRD, en el gate). En modo `deep` (split): `backend-dev` + `frontend-dev` + `test-writer`.
- El rol real `implementer` **ni siquiera existe** en el tipo `Role`: el código lo **remapea a `reviewer`** (un bug conceptual: muestra al constructor como revisor).
- Los demás roles del elenco (researcher, designer, architect, PM, security, devops, copywriter, analytics) **NO corren en el build** — corren en OTRAS fases del pipeline.

Resultado: la vista muestra un elenco de fantasía y "comunicación entre agentes" que no ocurre.

## 3. Cómo funciona el motor DE VERDAD (la realidad a reflejar — no inventar)

- Paradigma: **Dynamic Workflows** (un script JS determinista orquesta subagentes), **NO Agent Teams**. **No hay agentes peer comunicándose en vivo durante el build.** (Decisión DR-013; el primer build con el paradigma de "equipo charlando" gastó ~944 subagentes / 8 h / 76% re-trabajo y se descartó.)
- Construye **FRD por FRD**. Dentro de un FRD, levanta **N work orders en paralelo** (la "wave" según el modo): `pro=2`, `balanced=4`, `powerful=8` (default), `deep=6`.
- **Cada work order (modos no-split): UN solo agente `implementer` full-stack** lo construye end-to-end (su backend + frontend + tests) → corre su self-test → lo deja en `IN_REVIEW`. **Una figura por WO.**
- En modo **`deep` (split)**: el WO se parte en 3 agentes — `test-writer` + `backend-dev` + `frontend-dev` — con un contrato publicado entre ellos (es el único guiño al "equipo especializado").
- Cuando **todos** los WOs de un FRD están `IN_REVIEW`: **1 `reviewer`** hace el gate (revisión + integración) → `VERIFIED`. Uno por FRD, no por WO.
- Estados del WO: `PLANNED → IN_PROGRESS → IN_REVIEW → VERIFIED` (+ `BLOCKED`).
- **Hand-off entre WOs por DOCUMENTO** (cada WO cierra escribiendo un `## Status Note` con sus interfaces/contratos; el siguiente lo lee). Eso es la única "comunicación" real, y es **asíncrona, vía artefacto** — no un chat.
- **Especialización por FASE, no dentro del build.** El "equipo de expertos" SÍ existe, pero trabaja en secuencia y se comunica por documentos a través del tiempo:

  | Fase | Rol(es) | Entrega (el "mensaje" al siguiente) |
  |---|---|---|
  | Investigación | `researcher` | research.md |
  | Producto | `product-manager` | PRD + FRDs |
  | Diseño | `designer` + `copywriter` | mockups, tokens, textos |
  | Arquitectura | `architect` | blueprint + Build Plan |
  | **Construcción** | **`implementer`** (+ `reviewer` en el gate; `analytics` instrumenta) | el código |
  | Release | `security-auditor` + `devops` | auditoría + deploy |

  Cuando se construye, la investigación/diseño/arquitectura YA están hechas (son documentos); el `implementer` construye CONTRA ellas, no consulta a nadie en vivo.

## 4. Los eventos disponibles (la fuente de datos REAL)

- Archivo: `~/.claude/dashboard-events.ndjson` (append-only, una línea JSON por evento).
- Eventos clave: `{"event":"AgentWorking","at":"<ISO>","project":"mission-control","data":{"role":"implementer","wo":"WO-14-002"}}` (un agente arrancó en un WO) y `SubagentStop` (un agente terminó; trae `agent_type`, etc.).
- Lo lee `mission-control/lib/events.ts` (`readEvents`). El emisor está en el motor (`emit-event.sh` + el propio `pandacorp-build.js`).
- **Limitación a resolver:** hoy el evento solo trae `{role, wo}`. Para una vista rica/fiel probablemente haya que **enriquecer el evento** (añadir el FRD, la sub-actividad —escribiendo tests / corriendo verify / commiteando—, la fase, el hand-off). Eso es un cambio del MOTOR (`plugin/templates/shared/.claude/workflows/pandacorp-build.js`, que se copia a `mission-control/.claude/workflows/`). Propónlo si lo necesitas; es parte legítima del rediseño.

## 5. Los dos caminos a explorar

### Camino A — el Party del BUILD, fiel pero MÁS RPG/divertido
- Mockup actual (primer intento): `mission-control/prototype/party-proposal.html` (3 zonas por fase: Construyendo / En revisión / Verificado; sprites = WOs activos; tamaño de party = modo). **Funciona y es fiel, pero el owner siente que se parece demasiado a un Kanban** y no transmite la magia del Party viejo.
- **Lo que el owner quiere:** recuperar lo ameno/inspirador del Party original — cuadraditos moviéndose en un **mapa vivo**, pixel-art, animación, que dé ganas de seguir construyendo. PERO **sin inventar** comunicación/roles que no existen.
- Dirección sugerida (a refinar con referencias): menos "3 columnas estáticas" y más **mundo/mapa RPG**: los aventureros (WOs activos) martillando en una "forja", moviéndose a la "arena del juez" para revisión, al "salón de trofeos" al verificarse; **los hand-offs reales** (un WO termina y otro que dependía de él arranca, según el Build Plan) visualizados como entrega de un pergamino/cofre — eso ES la comunicación real (vía documento), mostrada de forma RPG y fiel. Animación, partículas, vida.

### Camino B — la vista del PIPELINE COMPLETO (el "equipo de expertos" de verdad)
- HTML nuevo a crear: `mission-control/prototype/party-pipeline.html`.
- Muestra **las 6 fases** (research → spec → design → blueprint → build → release) con sus especialistas, cada uno iluminándose/animándose **cuando su fase está activa**. Aquí SÍ se ve "todo el equipo trabajando", con fidelidad total (cada rol trabaja, en su turno). Tipo "mapa de campaña" / ruta de aventura RPG.
- El Party (Camino A) sería un acercamiento a la estación "Construcción" de este pipeline.

## 6. Tu misión (esta conversación)

1. Lee este brief y los archivos referenciados (sobre todo `party-proposal.html`, `layout.ts`, `lib/events.ts`, y el prototipo oficial `index.html` para el estilo).
2. **Busca referencias en internet** de UIs RPG / pixel-art / dashboards gamificados para inspirar el rediseño (WebSearch).
3. **Mejora el Camino A** (`party-proposal.html`): más RPG/mundo-vivo/animado, menos kanban, **manteniendo fidelidad** a cómo construye el motor.
4. **Crea el Camino B** (`party-pipeline.html`): el pipeline completo con sus roles.
5. Itera ambos por **follow-up** con el owner; quizá se quedan los dos. Previsualiza y muestra screenshots en cada vuelta.
6. Cuando el owner apruebe, el paso a producto es vía **`/pandacorp:iterate`** sobre FRD-06 (+ FRD-13 `tokens.ts`/`AGENT_COLOR`, FRD-09 `gamification`, FRD-10 hall) desde la sesión de MC — pero eso es DESPUÉS; primero el diseño en `prototype/`.

## 7. Archivos y rutas clave

- **Mockup Camino A:** `mission-control/prototype/party-proposal.html`
- **Prototipo oficial** (estilo + sprites pixel-art base64; ~1254 líneas): `mission-control/prototype/index.html`
- **Código real del Party:** `mission-control/app/projects/[slug]/_party/` → `layout.ts` (Role / MCROSTER / ZONE_ROLE — el elenco ficticio), `PartyScene.tsx`, `engine.ts`, `event-vm.ts`, `state-map.ts`, `PartyTab.tsx`, `EventFeed.tsx`
- **Contrato de roles (compartido):** `_party/layout.ts` (`Role`) ← subset de `AgentRole` en FRD-13 `tokens.ts` (`AGENT_COLOR`, fuente única para FRD-06 + FRD-12); `lib/gamification.ts` (`AGENT_RANKS`)
- **Eventos:** `~/.claude/dashboard-events.ndjson`, `mission-control/lib/events.ts`
- **Motor:** `plugin/templates/shared/.claude/workflows/pandacorp-build.js` (canónico) + `mission-control/.claude/workflows/pandacorp-build.js` (copia que corre)
- **FRDs:** FRD-06 party (IN_REVIEW), FRD-13 visual-system/tokens (VERIFIED), FRD-09 gamification (VERIFIED), FRD-10 achievements-hall (PLANNED, usa "party avatars"), FRD-12 observability (VERIFIED, usa AGENT_COLOR para el DAG)

## 8. Estilo (tokens Atelier, oscuro por defecto)

```
--canvas:#0F1517; --panel:#192123; --card:#222A2D;
--t1:#EDEBE7; --t2:#BAB7B0; --t3:#9E9B94;
--bd:#2F373A; --bd2:#4F5A5D;
--accent:#33B6D1; --accent-text:#62CFE8; --accent-bg:#003542;
--ok:#5EC386; --warn:#EBB25F; --danger:#F36356; --info:#5EB6E6;
fuentes: 'Pixelify Sans' (pixel/títulos), 'Space Grotesk' (display), system-ui (cuerpo)
```
Usa `font-variant-ligatures:none` con Pixelify Sans (la ligadura "fi" rompe palabras como "Verificado"). Gusto del owner: RPG/gamificado/dinámico, NO corporativo ni grids uniformes.

## 9. Cómo previsualizar

`mission-control/.claude/launch.json` tiene un config **`prototype`** (sirve `prototype/` con `python3 -m http.server`). Con las herramientas de preview: `preview_start` name `prototype`, luego navega a `/party-proposal.html` o `/party-pipeline.html` y haz `preview_screenshot`.

## 10. Reglas duras

- **NO inventar** comunicación/roles que el motor no hace. Fidelidad ante todo; lo bonito viene DESPUÉS de lo verdadero.
- Diseño en `prototype/` primero; a producto solo vía `/pandacorp:iterate` y con visto bueno del owner.
- Interacción en español; artefactos committeados en inglés (los mockups de `prototype/` pueden llevar copy en español como el oficial).

## 11. Contexto de la sesión donde nació esto (por si ayuda)

- El build de MC está **parado** (`running:false`), 52/109 work orders verificados, motor recién actualizado a **v8.10.0**. Listo para relanzar con `/pandacorp:implement maxAgents 150` cuando se decida — pero el owner decidió **arreglar el modelo de la Party ANTES** de cerrar las vistas de agentes (FRD-06/10), para no cementar el modelo ficticio.
- En la misma sesión se arreglaron dos cosas del motor: el freno fiable `maxAgents` (v8.9.0) y que el estado del FRD es un **rollup derivado de sus work orders** que el motor sincroniza (v8.10.0). No afectan el diseño del Party, pero explican el estado actual del repo.
- Lección ya capturada: las vistas de actividad deben derivarse de los **eventos reales** del motor, no de listas hardcodeadas.
