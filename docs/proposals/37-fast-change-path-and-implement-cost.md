# 37 — Camino de cambio rápido y coste real de `implement`

**Status:** proposed · **Date:** 2026-09-21 · **Owner:** factory maintainer
**Home:** propuesta de FÁBRICA (sobre el know-how de la propia fábrica), no de un proyecto de producto.
**Estado del repo al auditar:** `main`, árbol limpio, plugin v9.102.6. Auditoría estrictamente de solo lectura: nada de lo que hay aquí se ha ejecutado.

> Memo autocontenido. Cada recomendación lleva su evidencia (`fichero:línea` o comando), su impacto estimado, su red-team y su canario. Las cifras marcadas "estimación compuesta" NO son mediciones: se construyen sobre partidas medidas del build FRD-24.

---

## TL;DR

1. **Dónde se va el dinero:** de los **20,86 $** del build real de FRD-24 (2 work orders), el **70,0 % es review/gate**, 15,9 % reparar un único fallo, 7,2 % plumbing mecánico y solo **5,8 % construir**. El **78 % del gasto total es cache-read** (releer contexto), no producir texto.
2. **Dónde se va el tiempo:** 64,8 min de reloj, **100 % secuencial** (concurrencia máxima observada: 1 agente, con `maxAgents: 30` disponibles). Y en el camino manual, cada `Stop` paga `verify.sh` **completo** (133,6 s de media) sin fast-path.
3. **Veredicto sobre la hipótesis del owner: PARCIAL, con el peso desplazado.** "Rehace en vez de corregir" está **refutada** (el motor prohíbe el rebuild por escrito y solo hubo 1 rojo). "Reparar sale carísimo" está **confirmada** (4,30 $ = 3,5× lo que costó construir las dos WOs). "Relajar el script del gate" está **refutada** (ahorra 0 $ y ≤8 min).
4. **Causa raíz de la no-adopción, que nadie había nombrado:** `/pandacorp:change` **no produce código**, y en Mission Control `/implement` **no puede** drenar la cola (106/106 WOs `VERIFIED` ⇒ salida temprana antes del safe-point). Verificado por mí hoy. Es BL-0129.
5. **Las 5 palancas:** (a) drenar la cola de verdad; (b) tres niveles de rigor calculados por script; (c) abaratar al juez recortando su BUCLE, no su tier; (d) reparación dirigida con informe estructurado; (e) `visual-qa` a sonnet y en background.
6. **Esta semana (Fase 0, un día cada una):** A4 (conectar los 9 auto-tests), J1-1 (drenar la cola), J1-11 (cierre honesto del card), J1-3+A6 (`gate-report.json`), J1-8 (gate nocturno), A1 (fast-path del Stop), E-3 (`visual-qa` a sonnet, **la mayor palanca de $ de un día**).
7. **Escenario agregado estimado:** un FRD-24 equivalente bajaría a **≈7,2 $ y ≈15 min**; un cambio micro por el camino directo, a **≈0,25 $ y ≈5 min**.
8. **La pregunta final está en §9:** qué bloque apruebas (A, B, los dos, o solo la Fase 0). Nada se implementa sin ese OK.

---

## §0 · Re-verificación propia antes de escribir (CONV-13)

Tres cifras de titular re-verificadas **por mí, hoy, en vivo**, antes de construir nada encima:

| # | Qué verifiqué | Comando | Lo que vi | ¿Coincide con los informes? |
|---|---|---|---|---|
| a | Coste del build FRD-24 | `tail -1 mission-control/.pandacorp/track.jsonl` | `cost_usd_total: 20.859274` · `calls_total: 876` · opus `17.864173` / sonnet `2.199701` / haiku `0.7954` · `cost_excludes: ["cache_creation_input_tokens"]` · cache-write opus 1.192.788 + sonnet 589.914 + haiku 804.915 = **2.587.617** | **Sí**, exacto |
| b1 | BL-0129 (salida temprana antes del safe-point) | `sed -n 650,662p` y `sed -n 1870,1880p` del motor instalado | Línea ~656: `if (plan.frds.length === 0) { log('Nothing to build: every FRD is VERIFIED.'); await ensureStopped('nothing to build'); return ... }`. La única llamada a `safePoint()` está en **:1875**, dentro del bucle de olas, es decir **después** de esa salida | **Sí**. La promesa de `change/SKILL.md:8` ("`/implement` vacía la cola") es falsa en este caso |
| b2 | Estado de MC que activa esa rama | `grep -c "^implementation_status: VERIFIED" mission-control/docs/frds/*/work-orders/wo-*.md` | **106** | **Sí**: MC está permanentemente en la rama rota |
| b3 | Cola de cambios de MC | `ls -la mission-control/.pandacorp/inbox/changes/` | `portada-seal-coverage-commits-funnel-ideas.md` (7 jul, **76 días**), `decision-id-shared-emitter.md` (3 sep, residual del propio FRD-24), `README.md`, `done/` (último archivado real: julio) | **Sí** |
| c | `verify.sh` nunca se ablanda a sí mismo | `sed -n 1,30p mission-control/.pandacorp/verify.sh` | `set -euo pipefail` (línea 11) y la cabecera literal: *"This script is ALWAYS strict, it never softens itself... the PHASE-AWARENESS lives in the Stop hook"* (líneas 6-9). Flags existentes: `--since` (línea 22) y `--canary` (línea 30). Cero `--only`/`--files`/`--report-all`/`--level` | **Sí**, y condiciona todo el diseño: **el rigor tiene que vivir en el llamador** |

**Correcciones a la evidencia recibida que asumo de los jueces** (ellos también re-verificaron):
- Las cifras de sesiones manuales de `s7` (169 / 8 / 33 $) usaban una tabla de precios ilustrativa. **Se usan solo las de `s8`** (1,80 / 18,72 / 92,05 / 2,51 $).
- `m1` decía "2 skills con `user-invocable: false`"; el recuento real es **5**, luego hay **21 slash commands visibles**.
- Los standards `feature-flags.md`, `background-jobs.md` y `dependency-lifecycle.md` **sí están referenciados**: son huérfanos de *inyección*, no de catálogo. No se borran.

**Aviso de baseline que aplica a TODO el memo:** los 20,86 $ **excluyen** 2.587.617 tokens de `cache_creation`. A un múltiplo habitual de 1,25× input serían ~**+9,9 $** (el build real rondaría los **30,8 $** y lo medido sería el 68 %). Es **ESTIMACIÓN**: la tarifa de cache-write no está verificada en la tabla auditada. Consecuencia: toda palanca de caching está hoy fuera del radar del medidor.

---

# FASE 0 · Baseline medido

## 0.1 ¿Dónde se va el dinero y el tiempo?

Build real de referencia: **FRD-24 `decision-id-emitter`, 2 work orders, 2026-09-03** (`s8 §A.2/A.3`).

| Categoría | Coste USD | % | Llamadas | cache_read | Qué es |
|---|---:|---:|---:|---:|---|
| **(b) review / gate** | **14,6036** | **70,0 %** | 349 | 25,6 M | `foundation-gate` + `gate:frd-24` + `verify-patch` + `visual-qa` |
| **(c) reparación** | **3,3097** | **15,9 %** | 85 | 5,2 M | un solo `patch:` (opus, `effort: xhigh`) |
| **(d) plumbing mecánico** | **1,4982** | **7,2 %** | 332 | 7,1 M | 17 agentes haiku + el par baseline |
| **(a) construcción real** | **1,2132** | **5,8 %** | 96 | 4,8 M | `build:WO-24-001` + `build:WO-24-002` (sonnet) |
| **(e) planificación** | **0,2347** | **1,1 %** | 14 | 0,3 M | `plan` (architect, opus) |
| (f) hardening | 0,0000 | 0 % | 0 | 0 | no corrió en este run |
| **TOTAL** | **20,8594** | 100 % | **876** | 43,1 M | |

Los cinco agentes más caros, para que se vea el grano fino:

| agente | fase | modelo | coste | duración | contexto medio/llamada |
|---|---|---|---:|---:|---:|
| `gate:frd-24-decision-id-emitter` | Review | opus | **6,5115** | 1208 s | **93.738** |
| `visual-qa` | Review | opus | **5,5015** | 761 s | ~74.000 |
| `patch:frd-24-decision-id-emitter` | Review | opus | **3,3097** | 438 s | 63.475 |
| `foundation-gate` | Plan | opus | 1,6041 | 179 s | ~50.500 |
| `verify-patch:...` | Review | sonnet | 0,9865 | 151 s | 69.533 |

**Dos agentes (`gate` + `visual-qa`) son el 58 % del build entero.** Y por rol: `pandacorp:reviewer` = 4 agentes, **70,02 %** del coste; `pandacorp:implementer` = **17 agentes**, 28,87 %; `pandacorp:architect` = 1 agente, 1,13 %.

**El 78 % del gasto es `cache_read`**, no salida: 16,30 $ de los 20,86 $ (13,83 $ solo de cache-read de opus). Es decir, se paga sobre todo por **releer contexto turno a turno**, no por producir veredictos: del `gate` (6,51 $), 4,69 $ son cache-read; de `visual-qa` (5,50 $), 4,59 $.

## 0.2 `verify.sh` por sub-gate (medido, `m4`)

| # | Sub-gate | Duración | Acotable |
|---|---|---:|---|
| 1 | structure guard | ~30 ms | irrelevante |
| 2 | data-layer isolation | ~0 ms | irrelevante (vacuo sin Prisma) |
| 3 | API error contract RFC 9457 | ~10 ms | irrelevante (vacuo sin rutas API) |
| 4 | doc-lint (DR-077) | 4.445 ms | sí, pero no conviene |
| 5 | DR-100 readiness | 66 ms | irrelevante |
| 6 | biome | 1.014 ms | sí (por ficheros) |
| 7 | tsc | 2.509 ms | **no** (el proyecto es la unidad) |
| 8 | knip | 1.606 ms | **no** (dead code es global) |
| 9 | madge | 3.131 ms | **no** (ciclos son globales) |
| 10 | **vitest** | **82.277 ms (48 %)** | **sí** (`--changed` ya existe) |
| 11 | **Playwright** | **73.976 ms (34 %)** | parcialmente (hoy por spec, no por ruta) |

- **Los 9 sub-gates baratos suman 12,8 s.** Vitest + Playwright = 117 s = **88 % del gate**.
- Reloj completo: **107,4 s en frío**, 159,8 s en caliente, **media 133,6 s**.
- Toda la discusión de "acotar el gate" es, numéricamente, una discusión **sobre vitest y Playwright y nada más**.

## 0.3 Ciclos de reparación por WO

| Proyecto | WOs observadas | WOs con gate rojo |
|---|---:|---:|
| mission-control | 11 | **1** |
| personal-page-v2 | 20 | **2** |
| FRD-24 (el build medido) | 2 | **1** |

La reparación **no es frecuente**: es **cara cuando ocurre** (4,30 $ contando `patch` + `verify-patch`).

## 0.4 Prefijo de contexto fijo por sesión (`m3b`, regex `@<ruta>.md` con resolución recursiva)

| CWD | Ficheros | Líneas | Tokens estimados |
|---|---:|---:|---:|
| **mission-control** | 22 | 818 | **23.162** |
| personal-page-v2 | 24 | 780 | **19.037** |
| pandatrack | 3 | 436 | 10.618 |
| panda-corp (raíz) | 2 | 134 | 5.584 |

Reparto en MC: `docs/rules/*` 11.132 (48,1 %) · **raíz de la fábrica `AGENTS.md`+`CLAUDE.md` 5.583 (24,1 %)** · `guide.md` 4.098 · `AGENTS.md` del proyecto 1.746 · `CLAUDE.md` 603. Una sesión que edita `mission-control/src/` paga el 24 % en cómo se opera la fábrica: peso muerto completo para ese turno.

## 0.5 Comparación con el camino manual (`s8 §B`, `s7 §3`)

| sesión | fecha | duración | llamadas | modelos | coste | commits | $/commit | contexto medio/llamada |
|---|---|---:|---:|---|---:|---:|---:|---:|
| `12abc91b` | 07-09 | 10,4 min | 20 | opus | 1,7995 | 2 | **0,900** | 103.956 |
| `1744c53f` | 09-11 | 16,4 h | 322 | sonnet | 18,7218 | 23 | **0,814** | 255.910 |
| `c4b8fc46` | 08-09→10 | 49,6 h | 709 | sonnet + **fable (108)** | **92,0507** | 22 | **4,184** | **548.358** |
| `0e7de262` | 09-15 | 1,8 h | 38 | opus | 2,5127 | 0 | no medible | 118.977 |
| **Build FRD-24** | 09-03 | 64,8 min | 876 | opus+sonnet+haiku | 20,8594 | 8 | **2,608** | **52.142** |

Tres lecturas:
- **El contexto por llamada de una sesión manual es 2× a 10× el del build.** Estructural: cada subagente arranca limpio y acotado; una conversación larga arrastra todo su historial en cada turno. La sesión de 92 $ es **4,4× un build entero**.
- En $/commit son comparables (0,81-4,18 $ manual vs 2,61 $ build), pero **no es la misma unidad de trabajo**. La métrica honesta es **10,43 $/WO** (incluye TDD + gate + reparación + verificación).
- **Documentación: 3 de 3 cambios manuales auditados no actualizaron su doc canónica ni el decision-log**, incluido un fix de seguridad de 111 líneas en un repo que ni siquiera tiene `docs/decision-log.md`.

Y un dato que contextualiza todo: **en 5 semanas no hubo ni una sola sesión manual de Claude Code sobre mission-control que no fuera el build** (`s8 §B.2`). El proyecto insignia de la fábrica no se toca; los demás se tocan a mano.

## 0.6 Lo NO MEDIBLE hoy, y cómo instrumentarlo

| Hueco | Por qué duele | Cómo se instrumenta |
|---|---|---|
| **Nº de eventos `Stop` por sesión** | Todo el cálculo de latencia del hook (A1, J1-4) descansa en un supuesto de 20 turnos / 6 ediciones. No hay eventos de hooks en el stream (`m2 §5`) | Emitir un evento por Stop desde `verify-before-stop.sh` (el emisor ya existe: `emit-event.sh`) |
| **Duración por sub-gate** | Sin esto no se puede priorizar vitest vs Playwright con datos | `gate-report.json` con `duration_ms` por sub-gate (J1-3) + `emit-event.sh` (I-2) |
| **Coste de las sesiones manuales** | Solo el motor escribe `usage_summary`. El competidor real del motor es invisible | Extender `usage-rollup.mjs` a los transcripts de `~/.claude/projects/` (tienen `message.usage`), J1-13 / M-6 |
| **Cache-write tarifado** | El medidor omite 2,59 M tokens (~+9,9 $ estimados, +47 % sobre lo medido). Toda palanca de caching es hoy indemostrable | BL-0107: cruzar el contador propio con el `cost.usage` de OTel de Claude Code (I-1) |
| **Concurrencia real vs `maxAgents`** | FRD-24 corrió a 1× con 30 disponibles y nadie lo supo hasta esta auditoría | Derivable de `wf_*.json` (M-5) |
| **Nivel de rigor aplicado por cambio** | Un fast-path mal puesto sería invisible | Campo en el card + telemetría (M-4) |
| **Antigüedad de la cola de cambios** | Un card lleva 76 días y nada lo señala | MC ya lee el directorio; falta pintar la edad (M-8) |

**Los tres primeros son prerrequisito de gobierno:** sin ellos, cada propuesta de coste de este memo se decide a ojo y se verifica a ojo.

---

# FASE 1 · Diagnóstico con evidencia

Recorro los ocho sospechosos del encargo. Cada uno: **confirmado** o **descartado**, con la cita.

## a) El bucle de reparación: ¿rehace en vez de corregir?

**DESCARTADO como "rehace".** El motor es **patch-first por diseño y lo prohíbe por escrito**. `attemptPatch()` (`pandacorp-build.js:1088-1109`) recibe `findings` estructurados (`{wo, finding con file:line, failingTest RED-probado, files}`, schema `FINDINGS` en `:427-430`) y su prompt dice literalmente:

> *"Patch ONLY these on the EXISTING build, do NOT revert, do NOT rebuild from scratch, do NOT touch unrelated files"* (`:1101`)

La escalera es: parche dirigido → verificación independiente (`verifyPatched`, `:1142-1151`) → solo si falla, diagnóstico (`:1412`) → y solo entonces revert parcial o total. Frenos: `PATCH_ATTEMPT_CAP = 2` (`:74`) y `MAX_REOPENS = 3` (`:71`). Y existe un presupuesto de auto-reparación (DR-107) nacido de un incidente real en el que *"a 1-line i18n patch was discarded and its whole work order rebuilt from scratch"*: **la fábrica ya vivió el fallo que el owner intuye y ya lo arregló**.

**CONFIRMADO como "carísimo".** El único rojo de FRD-24 costó **4,30 $** (`patch` 3,31 + `verify-patch` 0,99) = **3,5× lo que costó construir las dos work orders** (1,21 $). Dos razones medidas: corre en opus con `effort: xhigh`, 85 llamadas a 63.475 tokens de contexto; y su re-gate es **whole-project a propósito** (`knip` + `biome .` + `tsc` completos, `:1103`, con el comentario *"a dead export must NOT slip to a sibling FRD"*). La sensación de "esto está rehaciendo cosas" tiene un referente real: **se re-recorre el proyecto entero por un fallo puntual**.

Y hay un freno que falta: los topes cuentan **intentos, no dinero**. Nadie supo que un rojo había costado 3,5× el trabajo hasta esta auditoría.

## b) Coste del gate: ¿el script o el agente?

**Hay que separar dos cosas que el owner llama igual.**

| | Gate como **script** (`verify.sh`) | Gate como **agente** (reviewer / visual-qa) |
|---|---|---|
| Qué es | 11-12 sub-gates deterministas | 4 invocaciones LLM |
| Coste en tokens | **0 $** | **14,60 $ = 70,0 %** |
| Coste en tiempo | ~2,2 min/pasada, 2-3 pasadas ⇒ **5-8 min de 64,8 (8-12 %)** | 1208+761+179+151 s = **38,3 min de 64,8 (59 %)** |
| Ahorro al relajarlo | **0 $, ≤8 min** | hasta 14,60 $ |

**Conclusión dura: relajar el script ahorra 0 $ y como mucho 8 minutos.** Y de esos 8, el 88 % está en vitest+Playwright, que `--since` **ya acota desde DR-106** y ya está encendido en el build.

**Por qué el gate agente cuesta 6,51 $: no es el veredicto, es el bucle.** 99 llamadas × 93.738 tokens de contexto medio; el output entero (72.972 tokens) vale 1,82 $, y **4,69 $ son cache-read**: releer el árbol turno a turno mientras explora, corre comandos y escribe tests adversariales. Una sola llamada de juicio sobre un informe ya digerido costaría ~0,40 $. La diferencia 6,51 → 0,40 no es menos rigor: es **quién recoge la evidencia**. Hoy lo hace un opus a 94k tokens por turno; podría hacerlo el script, gratis.

## c) Context bloat

**CONFIRMADO, en dos planos distintos que no hay que mezclar.**

- **Prefijo de sesión** (23.162 tokens en MC, 19.037 en PPv2): es peso de atención y calidad. A precio de cache-read, recortar 8.600 tokens en una sesión de 322 llamadas ahorra ~**0,55 $**. **No es la palanca de dinero**, y venderla como tal decepcionaría.
- **Contexto inyectado por dispatch**: eso sí es dinero. 93.738 tokens/llamada en el gate, 53.880 en construcción, 24.172 en plumbing. El checklist de `implementer.md:12` manda leer casi todos los documentos grandes del proyecto (`architecture.md` 377 líneas, `components.md` 232, `DESIGN.md` 180) antes de tocar una WO.

## d) Fan-out: 22 `agent()` para 2 work orders

**CONFIRMADO.** El run_dir tiene 22 pares `agent-<hex>.jsonl` + `.meta.json`, y el estado del workflow confirma `agentCount: 22`. De esos, **17 son plumbing mecánico** (dispatch ×2, commit ×2, safe-point ×2, pin, gate-worktree, archive-changes, notify-end, release-lease, sync-rollups, baseline, baseline-precheck).

El plumbing puro (excluyendo el par baseline) cuesta **0,739 $ (3,5 %) y 555 s = 9,3 min (14,3 % del reloj)** en un run 100 % secuencial. Y son literalmente envoltorios de un comando: `capturePin` (`:1014-1016`) lanza un agente LLM cuyo trabajo entero es *"Return the current MAIN-tree HEAD short sha (`git rev-parse --short HEAD`)... Change nothing, commit nothing."*; `sync-rollups` (`:97`) lanza un agente para ejecutar un CLI y devolver un campo JSON.

**Matiz honesto sobre el 100 % secuencial:** no es un defecto del scheduler. Las dos WOs podían haber sido paralelas (~130 s de ahorro), pero el gate y `visual-qa` son serie por diseño, y la concurrencia C2 **no puede activarse en un build de una sola FRD** (el primer gate de cada FRD es SERIAL-FIRST, `:826,836`). El log del propio motor lo dice: *"first gate attempt this run, running SERIAL"*.

## e) Sobre-ceremonia documental

**CONFIRMADO.** Para un cambio de 1 línea (`s2 §A`):
- `/change` escribe **2 ficheros** (el card + la fila del README) y lee 1. **0 subagentes.** Y termina: no hay código.
- El drenado posterior lee **≥6 ficheros** y escribe **≥3** antes de la primera línea de código, en el caso mínimo de "extender un WO existente".
- Si el cambio se clasifica como feature nueva: **7-9 ficheros de doc** y **3-4 subagentes** (researcher → PM → architect → work-orders) antes del primer `implementer`.

Y una asimetría que explica la deuda: `documentation-and-decisions.md` dice *"Don't record trivial changes already obvious from the commit"* pero **nunca define trivial**. En la práctica, o se escribe todo (la fábrica) o no se escribe nada (el manual, 3 de 3).

## f) Pins de modelo: lo que dejó abierto la propuesta 33

**CONFIRMADO, y peor de lo que la 33 dejó escrito.** En **≥20 sitios** del motor el `model:` explícito del dispatch (`MECH`/`P.worker`/`P.judge`/`woModel`) **sobrescribe el pin del frontmatter**. Los 15 sitios `model: MECH` verificados uno a uno: `:543, 560, 694, 721, 1005, 1017, 1043, 1054, 1344, 1969, 2019, 2064, 2130, 2137, 2143`. Catorce de los quince usan la identidad `pandacorp:implementer` para tareas que no tienen nada que ver con "ejecutar un work order con TDD", lo que les inyecta un prompt de 45 líneas y el grant completo de tools (`Read, Write, Edit, Grep, Glob, Bash`) para una tarea de una línea.

Lo que la 33 dejó abierto y sigue abierto:
- **`copywriter` en opus+high:** sus 7 reglas son voz, microcopy, i18n, legibilidad, landing y a11y de texto. **Cero decisión arquitectónica cara de revertir**, el único de los 5 opus sin esa justificación en su propio texto. Y **no aparece ni una vez en el run FRD-24**: está fuera del camino caliente, luego el canario A/B es casi gratis.
- **R-09, `test-writer` nunca escala:** `:768` despacha `test:${wo.id}` siempre en `P.worker`, mientras `be`/`fe`/`build` reciben `woModel` + `effort: 'high'` en `difficulty: high`. En un WO difícil el código escala a opus y **su test de aceptación no**. Riesgo de calidad acotado: solo aplica al modo `deep`.
- **Los rungs bajos de effort no se usan nunca:** el motor solo usa `high` (4 sitios) y `xhigh` (5), pese a que `model-tiers.json` define `["minimal","low","medium","high","xhigh"]`.
- **R-08 SÍ está cerrado** (v9.98.11, el puntero a DR-073 existe en los 3 ficheros). No hay nada que hacer ahí.

## g) Reinvención en el motor

**PARCIALMENTE CONFIRMADO.** Tabla de `s1 §f` cruzada con el veredicto de `j2 §6.1`:

| Bloque | Líneas | ¿Nativo lo cubre? | Riesgo de tocarlo | Veredicto |
|---|---:|---|---|---|
| Schemas de I/O (`*_SCHEMA`) | 332-534 | No (es el uso correcto de `schema` en `agent()`) | Alto | **Mantener** |
| Constantes de eventos/telemetría | 157-291 | No (contrato de producto: La Fragua lo lee) | Medio-alto | **Mantener** |
| Contador ponderado (`agentSpawned`, `COST()`) | 104-155 + dispersos | Parcial: existe `budget` nativo, documentadamente insuficiente | Alto (es el guardarraíl nocturno) | **Mantener** hasta cerrar BL-0098/BL-0109 |
| Baseline self-heal (DR-067) | 547-593 | No | Medio | **Mantener y arreglar** (BL-0124: costó 0,76 $ y 252 s por leer mal el árbol) |
| Planificador | 636-674 | No | Alto | **Mantener**. Barato hoy (0,23 $) pero lee TODOS los `frd.md`+`blueprint.md` en una llamada: en MC son 23 FRDs |
| Gate serial (`frdGateSerial`) | 852-873 | Parcialmente (`/code-review`) | Medio | **Mantener** (aplica DR-015) |
| **Gate split (`frdGateSplit`)** | 875-988 | **Sí, candidato fuerte**: `/code-review --ultra` es el mismo patrón | Bajo-medio con post-proceso | **Evaluar, no borrar a ciegas.** Puede disparar **hasta 13 `agent()` por FRD** |
| Escalera de recuperación | 1059-1217, 1407-1666 | No (DR-073/107/117) | Alto | **Mantener** |
| **Worktree de gate C2** | 269-283, 990-1057, 1782-1837 (~150) | **Posiblemente** (`EnterWorktree`/`ExitWorktree`) | Medio | **Depende del spike E-1** |
| `commitChain` (escritor único de git) | 715-729, 1040-1057 | No | Alto (pérdida de trabajo) | **Mantener, piso innegociable** |
| Scheduler de olas globales | 1261-2022 (~450) | No (BL-0021) | Alto | **Mantener** |
| Hardening + cierre | 2070-2145 | No (DR-085) | Alto | **Mantener** |

Dato que bloquea la decisión: los dos motores del repo usan **únicamente** `agent()`, `parallel()`, `log()` y `budget`. **Cero `shell()`/`bash()`/`exec()`.** No sabemos si el runtime los expone. De eso dependen ~150 líneas del bloque C2 y los 14 sitios MECH. **Spike de 30 minutos (E-1).**

## h) Arranque: de `/change` a la primera línea de código

**CONFIRMADO, y es la causa raíz de la no-adopción.**

```
owner → /change → 2 ficheros escritos → FIN DE LA SESIÓN. No hay código.
                                          │
                        ... tiempo indeterminado ...
                                          ▼
              alguien lanza /implement → planner → ¿hay FRDs pendientes?
                                          │
              MC: 106/106 VERIFIED ⇒ plan.frds.length === 0
                                          ▼
              línea ~656: ensureStopped('nothing to build') · RETURN
                                          ✗
              safePoint() (línea 1875, el único drenado) NUNCA se alcanza
```

Consecuencias medibles hoy en MC: un card de bug lleva **76 días** en `ready`; el card que originó FRD-24 sigue en `ready` **18 días después** de que su FRD se verificara, pese a que el agente `archive-changes` **sí corrió** en ese build (0,06 $); el último archivado real en `done/` es de **julio**.

**Aunque el gate costara 0 $, el owner seguiría sin usar `/change`**, porque la puerta única no desemboca en código.

## i) Hallazgo extra: el hook `Stop` es el gate más caro del sistema

Fuera de un build activo, **cada Stop paga `verify.sh` completo**: `verify-before-stop.sh:90` hace `out=$(bash "$verify" 2>&1)` **sin argumentos y sin comprobar `git status`**. No existe fast-path: con el árbol perfectamente limpio se pagan los 133,6 s igual. El guard DR-099 de "red ajeno" actúa **después** de haber pagado el gate entero.

Y en toda sesión de Mission Control se suma `check-derived-drift.sh`, que se dispara en **cada Stop** porque MC comparte el `.git` de la fábrica (`:42-43`): copia `plugin/agents`, `plugin/skills`, `plugin/runtime/*.json` y el motor a un `mktemp -d` y corre **5-6 procesos `node`** más varios `diff -rq`/`cmp`, en una sesión que nunca tocó `plugin/`.

**La inversión es absurda:** el camino de fábrica paga el gate de script **más barato** (`--since`, acotado) y el camino manual paga el **más caro** (completo, en cada turno), sin juez y sin docs.

---

# FASE 2 · Red-team

## 2.1 La hipótesis del owner, contrafactual a contrafactual

> *"Lo más lento es que rehace demasiadas cosas: no pasa el gate e intenta volver a hacerlo, en vez de corregirlo. Quizá hay que buscar un punto medio donde no todo tenga que pasar el 100 % de los gates."*

Recalculados con la tabla de precios auditada sobre los tokens reales de cada agente (`j1_counterfactual.py`):

| Escenario | Coste del build | Δ vs 20,86 $ | ¿Legítimo? |
|---|---:|---:|---|
| Baseline FRD-24 | 20,86 $ | — | — |
| Quitar `visual-qa` | 15,36 $ | **−26,4 %** | Sí en el gate por-FRD (DR-072 ya lo hace advisory); **no** como pase de cierre en un proyecto UI |
| `visual-qa` en sonnet (E-3) | 17,56 $ | **−15,8 %** | **Sí. La palanca limpia** |
| `visual-qa` en haiku | 16,46 $ | −21,1 % | Riesgo alto sobre el eje más frágil del owner |
| Reviewer del gate en sonnet | 16,95 $ | −18,7 % | **NO**: el worker fue sonnet, rompe DR-015 |
| Gate = 1 llamada opus con el output del script | 14,75 $ | **−29,3 %** | Parcialmente (ver §2.1 más abajo) |
| Gate de 1 llamada + sin `visual-qa` | 9,25 $ | −55,7 % | Techo teórico de "relajar el gate agente" |
| Quitar `foundation-gate` | 19,26 $ | −7,7 % | No: es bloqueante, DR-057 |
| Quitar toda la reparación | 16,56 $ | −20,6 % | No como política; sí acotando su coste |
| Review/gate a coste cero (imposible) | 6,26 $ | −70,0 % | Cota superior absoluta |

## 2.2 Veredicto por componente

| Componente de la hipótesis | Veredicto | Justificación numérica |
|---|---|---|
| "Rehace en vez de corregir" (rebuild en vez de patch) | **REFUTADA** | `attemptPatch:1101` prohíbe el rebuild por escrito; 1/11 y 2/20 rojos; reparación = 15,9 % |
| "Reparar sale carísimo" | **CONFIRMADA** | 4,30 $ por un rojo = **3,5× construir las 2 WOs** |
| "Relajar los gates (el script) es la palanca" | **REFUTADA** | **0 $** y ≤8 min de 64,8; `--since` ya existe y ya se usa |
| "Hace falta un punto medio de rigor" | **CONFIRMADA, reubicada** | No hay ningún nivel hoy (0 hits de `GATE_LEVEL`); la clase de servicio (`expedite`/`standard`) **solo cambia el orden de la cola, nunca el rigor** (`change/SKILL.md:25-29`). El punto medio va **en el agente**, en el **alcance de la evidencia** y en el **hook Stop** |
| "Es demasiado lento y quema demasiados tokens" | **CONFIRMADA** | 70 % en verificación, 78 % del gasto es cache-read, 5,8 % es construir |
| Causa raíz implícita ("el gate es el culpable") | **REFUTADA** | La causa raíz de la NO-ADOPCIÓN es de mecanismo: `/change` no produce código y el drenado está roto (BL-0129) |

**La frase que resume el hallazgo:** el owner tiene razón en el síntoma (caro y lento), se equivoca de órgano (el script del gate), y el órgano real, que él no menciona, es que **la puerta que le pidieron usar no desemboca en código**.

## 2.3 Red-team del camino manual (el competidor a batir)

**Su mejor caso, sin adornos:** la sesión `1744c53f` cerró **23 commits y un FRD completo en 16 h por 18,72 $**, contra 20,86 $ por **2 work orders** de la fábrica. Por superficie entregada, el manual ganó esa comparación. Y en latencia gana siempre: **el mismo turno** contra una cola que en MC es imposible de drenar.

**Factura oculta #1: el coste crece con la DURACIÓN de la sesión, no con el tamaño del trabajo.**

| Origen | Contexto medio/llamada | Coste marginal de un turno más |
|---|---:|---:|
| Build FRD-24 (media global) | 52.142 | — |
| Gate opus (el agente más caro del build) | 93.738 | 0,047 $ |
| Sesión manual corta | 103.956 | 0,021-0,052 $ |
| Sesión manual media | 255.910 | 0,051 $ |
| **Sesión manual larga** | **548.358** | **0,110 $** |

Un turno cualquiera de una sesión larga cuesta **2,3× más que un turno del agente más caro de todo el build**, aunque ese turno sea trivial. **El manual no es barato: es barato mientras la sesión es corta.**

**Factura oculta #2: la documentación no se escribe.** 3 de 3 cambios auditados, sin doc canónica y sin decision-log. El tercero es un fix de seguridad sin rastro en ninguna parte. Es la deuda que `/pandacorp:sync` existe para pagar en frío y caro después.

**Factura oculta #3: paga el gate más caro del sistema en cada turno** (§1.i), sin juez y sin docs.

**Lo que el owner gana de verdad, ordenado:** (1) latencia, factor dominante; (2) dirección continua, puede decir "así no" en el minuto 3 en vez de recibir una caja de 64,8 min; (3) cero ceremonia de entrada; (4) cero cambio de contexto. **Ninguno de los cuatro es "es más barato".**

**Veredicto:** el manual gana en latencia y control, empata o gana en sesiones cortas, pierde claramente en sesiones largas y en documentación. **No hay que batirlo: hay que adoptarlo y ponerle un cierre barato.** Cualquier diseño que exija renunciar a "código en el mismo turno" va a perder otra vez, porque ya perdió: 8 de 11 proyectos viven fuera del mecanismo y el proyecto insignia lleva 18 días sin un commit de producto.

## 2.4 Piso innegociable (fusión de `j1 §4.2` y `j2 §5.3`), con detección mecánica

Un disparo del piso fuerza `critical`, **prohíbe el camino rápido**, obliga a `security-auditor` y corre el gate completo.

| Dominio | Detección mecánica (determinista) |
|---|---|
| **Auth / autorización** | rutas `**/lib/auth/**`, `middleware.ts`, `**/_actions/**`, `**/actions.ts`, `src/app/api/**`; contenido añadido con `getServerSession`, `signIn`, `Authorization`, `bearer`, `bcrypt`, `jwt`, `session.` |
| **Dinero** | rutas o contenido con `stripe`, `billing`, `payment`, `checkout`, `invoice`, `subscription`, `price_`, `webhook` |
| **PII** | contenido en modelos/esquemas/migraciones con `email`, `phone`, `dni`, `passport`, `iban`, `card_number`, `cvv`, `address`; rutas `prisma/**`, `**/*.sql`, `**/migrations/**` |
| **Persistencia / pérdida de datos** | rutas `**/queries/**`, `prisma/**`; contenido con sentencias SQL destructivas (regex sobre `DELETE`/`DROP`/`truncate`), `deleteMany`, `rmSync`, `unlink(`, y el borrado recursivo forzado de shell (regex `\brm\s+-[a-zA-Z]*r[a-zA-Z]*f\b`) |
| **Irreversibles / despliegue** | regex `(push|reset)\s+--(force|hard)` y `\b(vercel|wrangler|fly)\s+(deploy|publish)\b`; rutas `.github/workflows/**`, `next.config.*` |
| **Secretos** | rutas `.env*`, `**/secrets*`; contenido con patrón de clave (`sk-`, `AKIA`, encabezado PEM) |
| **Los oráculos mismos** (DR-080) | `e2e/**`, `**/-snapshots/**`, `.pandacorp/verify.sh`, `biome.json`, `docs/design/design-tokens.json`, y cualquier diff en `_tests/**` con **borrado neto** de casos |
| **La maquinaria de la fábrica** | `plugin/**`, `factory/**`, `.pandacorp/*.sh` |
| **Dependencia inversa (S17)** | `madge`: si un fichero del piso importa transitivamente un fichero tocado, escala |
| **Fail-closed del detector** | clasificador ausente, con error o diff ilegible ⇒ **`critical`**, nunca `normal` |

**Y lo que no se toca bajo ninguna circunstancia:**

| Mecanismo | Por qué |
|---|---|
| `block-dangerous.sh` | Único incidente de pérdida permanente de datos (BL-0035) con causa raíz desconocida. Sus falsos positivos **se rodean**, jamás se debilita el gate (LESSON-0105/0109) |
| Fail-closed por harness ausente (DR-055/056/074/075) | Nacieron de que MC pasó 112/112 en verde **sin menú de navegación y sin ser responsive**. Se puede acotar el **alcance** de los specs; nunca permitir que falten |
| El re-gate de certificación whole-project | `--only` **no certifica nunca** |
| DR-015 (juez ≠ generador) y DR-080 (el autor no toca el test que lo juzga) | Estructurales |
| Lease en dos fases, `commitChain`, `apply-gate` | Irreversibilidad y pérdida de trabajo |
| `MAX_REOPENS = 3`, freno ponderado, bloqueo `needs-owner` | Único guardarraíl de un build nocturno sin supervisión |
| El motor como escritor único mientras corre | El camino rápido **se niega** con un build activo |
| `verify-then-archive` de la cola (mover, nunca borrar) | `changes/` está gitignored: un borrado pierde la intención del owner |
| Registro de atribución `.touched` | Moverlo rompe el fail-closed de DR-099 |
| Hand-back ruidoso de DR-099 | Un cierre que no aterriza se dice en el chat, en el momento |

## 2.5 Red-team de esta propia propuesta

**Primero, un dato que modera nuestro propio titular.** Criterio de tamaño aplicado a los **918 commits reales de los últimos 90 días** de tres repos:

| Repo | n | tamaño micro (≤20 líneas, ≤3 ficheros) | normal (≤150, ≤10) | grande |
|---|---:|---:|---:|---:|
| mission-control | 330 | 30,9 % | 29,7 % | 39,4 % |
| personal-page-v2 | 293 | 34,1 % | 32,1 % | 33,8 % |
| pandatrack (100 % manual) | 295 | 9,5 % | 33,6 % | **56,9 %** |
| **Total** | **918** | **25,1 %** | 31,7 % | **43,2 %** |

- **L0 no es la palanca económica: es la emocional.** Un cuarto de los commits, y son los baratos de todos modos. Lo que compra es "código en el mismo turno sin ceremonia".
- **L1 es donde está el dinero** (~32 %), y es el tramo donde 10,43 $/WO baja a ~1,5 $ estimados.
- El proyecto más activo del owner (pandatrack) es **57 % grande** y vive **completamente fuera** de la fábrica. Ese hueco lo cubre `spec --micro` (S-1), no el camino de cambio.
- **Sesgo conocido:** un *cambio* suele ser varios commits, así que esta distribución **sobreestima** la proporción micro. Es cota superior.

**Qué se rompe, propuesta a propuesta:**

| # | Pieza | Qué se rompe | Detección / mitigación | ¿Se sostiene? |
|---|---|---|---|---|
| R1 | `--only` en el bucle de reparación | Colisiona con el invariante literal del motor (`:1103`, *"a dead export must NOT slip to a sibling FRD"*) | `--only` escribe `"scope":"partial"` y el motor **asserta** que `VERIFIED`/`last_green_sha` exigen `scope ∈ {since, full}`. Test de regresión obligatorio. Ámbito: solo los ≤2 ciclos internos de DR-107 | Sí, **con esa jaula** |
| R2 | Techo de llamadas al reviewer L1 | **Lo más peligroso del memo.** El gate es el ÚNICO oráculo independiente; menos turnos = menos tests adversariales (DR-080) | (a) el techo aplica a turnos de **exploración** y empieza generoso (30), apretando con datos; (b) canario obligatorio: mismo FRD con y sin techo; (c) si pierde un hallazgo de clase **corrección**, se revierte | Sí, **solo tras canario**. Es la primera que se suelta si se quiere reducir riesgo |
| R3 | L0 sin juez LLM | Un cambio de CSS puede romper visualmente sin que nada lo vea | **Corrección del propio diseño:** un L0 que toque `*.css` o JSX con cambio de layout corre el spec `visual` **de la ruta tocada** (segundos) | Sí, corregida |
| R4 | Clasificador por rutas | Ve rutas y líneas, **no semántica**: 5 líneas en `lib/formatting.ts` pueden romper auth | **Señal S17**: dependencia inversa con `madge` (ya instalado, ya en el gate, ~3 s) | Sí, con S17 |
| R5 | El nivel como eje nuevo | Un agente con prisa declara todo `micro` | Lo calcula un **script**, el LLM solo **escala**, y el nivel queda registrado en el card y en telemetría (M-4) | Sí |
| R6 | Docs en lote | Si el cierre no ocurre, la doc se pierde: el fallo exacto del manual (3 de 3) | `status: closing` + `implemented_sha`, y `doc-lint.sh` (ya dentro del gate, 4,4 s) **enrojece un `closing` de más de 48 h** | Sí, **es condición** |
| R7 | Gate nocturno | Un rojo que nadie lee, o un flaky que bloquea la mañana | **No bloquea**: marca `safe_to_test: false` + notificación + evento | Sí |
| R8 | Un camino nuevo | Añadiría un cuarto front door justo cuando el bloque B propone bajar de 21 a 11 | **Doble corrección:** (1) es un **flag de `/pandacorp:change`**, no un comando; (2) el close-out es un **modo cálido de `/pandacorp:sync`**, no un skill nuevo. **Cero front doors nuevos** | Sí, corregida |
| R9 | Las cifras de L0/L1 | Son **estimaciones compuestas** | Marcadas como tales. Nada se declara ahorrado hasta el canario con I-1 detrás | — |
| R10 | El supuesto de fondo | Que el owner adoptará un camino **porque es rápido**. El competidor real puede ser "cero ceremonia, ni siquiera un card" | El criterio de aceptación es **adopción, no coste**. Si en 4 semanas no entra ≥1 cambio/semana, la captura debe volverse **pasiva**: el hook de **BL-0064**, no un comando | — |
| R11 | Todo el eje de niveles dentro del motor | El ahorro sería menor porque el motor sigue pagando plan + baseline + plumbing | Por eso la decisión es **C con B por defecto**: el camino directo **no paga** esas partidas | — |
| R12 | **Sesgo central del bloque B** | Cuatro propuestas debilitan mecanismos construidos **después de un incidente real** | Los contrapesos son **A4** (conectar los auto-tests, va primero) y **C-5** (gate de presupuesto). **Si solo se ejecutan las palancas de ahorro y no los contrapesos, el plan degrada la fábrica** | — |

**Regresiones aceptables vs nunca:**

| Aceptable | Nunca |
|---|---|
| Un nit cosmético que llega a `main` sin `visual-qa` (DR-072 ya lo hizo advisory) | Un rojo del gate ignorado, en cualquier nivel |
| Una entrada de decision-log escrita 20 min después, en lote | Un cambio del piso clasificado por debajo de `critical` |
| `knip`/`madge`/vitest whole al cierre de FRD y de noche, no en cada micro | Un `--only` promoviendo a `VERIFIED` |
| Un cambio `micro` sin WO propio | Un implementador bendiciendo su propio baseline |
| Menos tests adversariales en L1 que en L2 | Cero tests adversariales en L1 |
| Que el clasificador escale de más y algo barato corra caro | Que escale de menos por fallo propio |

**Patrón que emerge del red-team del plan:** en 5 de 7 regresiones posibles, **el oráculo que las detectaría no existe todavía**. Es LESSON-0113 aplicada a nosotros mismos. De ahí que la Fase 0 empiece por un arnés y la Fase 1 por instrumentación, y no por las palancas más golosas.

---

# FASE 3 · Propuesta

## BLOQUE A · El camino de cambio (el 70 % de este memo)

### A.0 Cinco principios

1. **El rigor vive en el llamador, nunca dentro de `verify.sh`.** El script se autodeclara siempre estricto (verificado, §0c). Los niveles se implementan **componiendo flags de alcance** desde el hook y el motor; una invocación desnuda sigue siendo el gate máximo.
2. **Abaratar al juez recortando su BUCLE, no su tier.** 78 % del coste es cache-read de exploración. Bajar opus→sonnet ahorra 2,5×; darle la evidencia digerida y un techo de turnos ahorra ~10×, **sin tocar DR-015**.
3. **Fail-closed en el nivel, no en el gate.** El nivel decide **qué evidencia se recoge**, nunca si un rojo bloquea. Un rojo bloquea siempre, en los tres niveles.
4. **El default es el camino del owner.** Código en el mismo turno; la fábrica aporta clasificación, gate y documentación **después**, en lote y barato.
5. **Sacar trabajo de la conversación del owner.** Un turno suyo en una sesión larga cuesta 0,11 $; un subagente fresco cuesta una fracción. **Delegar es una palanca de coste incluso a igualdad de tier.**

### A.1 Tres niveles de rigor

Campo nuevo `rigor: micro | normal | critical` en el frontmatter del card, **derivado automáticamente**, nunca preguntado. Convive con `class: expedite|standard` sin solaparse: **`class` decide CUÁNDO, `rigor` decide CUÁNTO.**

| | **L0 · micro** | **L1 · normal** | **L2 · critical** |
|---|---|---|---|
| Ejemplo canónico | fix CSS de 8 líneas, un texto i18n, un umbral | una WO típica (18 líneas + tests) | auth/pagos/datos, FRD nueva, rediseño, `rebuilds_verified` |
| Sub-gates | los **9 baratos** (12,8 s) + `vitest --changed` (~15 s) + `smoke` si toca UI (~10 s) | = hoy `--since`: 9 baratos + `vitest --changed` + **smoke + shell** | **`verify.sh` completo sin flags** (+ vitest whole 82 s + visual + responsive + headers 74 s) |
| Tiempo de gate | **~28-40 s** | ~45-60 s | **~134 s** |
| Reviewer agente | **Ninguno.** El oráculo es el script canónico (no lo escribió quien implementó) | **1 agente opus** (DR-015 intacto: el worker es sonnet), **techo duro de turnos**, evidencia pre-digerida, ≤1 test adversarial por AC (máx. 3) | Como hoy: sin techo, `frdGateSerial`/`Split`, tests adversariales sin límite |
| Coste del reviewer | **0 $** | **~0,70 $** (vs 6,51 $ hoy) | 6,51 $ (sin cambio) |
| `visual-qa` | No (salvo la corrección R3: spec visual de la ruta tocada) | No (DR-072 ya lo hace advisory) | Sí, **en sonnet (E-3) y en background (E-4)** |
| `security-auditor` | No | No | **Sí, obligatorio** si disparó el piso |
| Docs | card → `done/` + 1 línea en el lote; decision-log **solo si `supersedes:`** | Status Note del WO + 1 entrada de decision-log + rollups + card → `done/` | Cascada completa (FRD/blueprint/ADR/progress) |
| Cuándo | **en lote, al cierre, 1 llamada** | **en lote, al cierre, 1 llamada** | por paso, como hoy |
| Commit | 1 commit con código + docs | 1 commit | `commitChain` del motor |
| **Coste end-to-end estimado** | **~0,25-0,40 $** | **~1,2-2,5 $** | ~10-14 $ (baseline actual) |
| **Latencia estimada** | **~4-8 min** | **~12-20 min** | 32+ min/WO |

**Tres detalles que hacen que esto no sea "relajar":**
- El conjunto de gates que **pueden ponerse rojos** es el mismo en los tres niveles para el código tocado. Lo que cambia es el **alcance** de vitest y Playwright, que es exactamente lo que DR-106 ya decidió para el gate por-FRD. No se inventa una excepción: se extiende una aceptada.
- **L0 no tiene juez LLM porque no tiene superficie de juicio**: se define como "sin comportamiento nuevo, sin ruta nueva, sin fichero nuevo, sin tocar el piso". Si algo de eso aparece, deja de ser L0 **por construcción**.
- **El nivel nunca degrada el cierre de FRD ni el de release.** `verify.sh` completo + `visual-qa` + hardening siguen corriendo enteros al cerrar una FRD y antes de `release`.

### A.2 Clasificación automática: 17 señales, sin preguntar al owner

Un script determinista (`plugin/scripts/classify-change.sh`, ~80 líneas de bash + grep) recibe el diff y el frontmatter del card y devuelve `{rigor, reasons[], floor_hits[]}` en JSON. **El LLM nunca calcula el nivel: solo puede subirlo.**

| # | Señal | Cómo se mide | Nivel |
|---|---|---|---|
| S1 | ≤20 líneas netas **y** ≤3 ficheros **y** 0 ficheros nuevos **y** 0 rutas nuevas | `git diff --numstat` | **micro** (candidato) |
| S2 | ≤150 líneas **y** ≤10 ficheros | ídem | normal |
| S3 | >150 líneas **o** >10 ficheros **o** ≥1 fichero nuevo bajo `src/` | ídem | **critical** |
| S4 | Ruta nueva (`page.tsx`/`route.ts`/`layout.tsx`) | `--diff-filter=A --name-only` | **critical** + bless de baseline visual |
| S5 | **PISO** auth/datos | glob de rutas | **critical + security-auditor** |
| S6 | **PISO** dinero/PII | glob + grep sobre el diff | **critical + security-auditor** |
| S7 | **PISO** secretos/infra (`.env*`, CI, `next.config.*`, `biome.json`, `.pandacorp/*.sh`, `plugin/**`, `factory/**`) | glob | **critical** |
| S8 | **PISO** irreversible / pérdida de datos | regex sobre el diff | **critical + gate de owner** |
| S9 | **PISO** oráculos (`e2e/**`, snapshots, `_tests/**` con borrado neto, design-tokens) | `--numstat` con `deleted>added` | **critical** (DR-080) |
| S10 | Card con `rebuilds_verified: true` | frontmatter | **critical** |
| S11 | Card con `supersedes:` no vacío | frontmatter | ≥ **normal** (dispara DR-116) |
| S12 | WO destino con `difficulty: high` **o** `reopen_count ≥ 1` | frontmatter del WO | **critical** (espeja `pickWorkerModel`) |
| S13 | Solo `*.css`, `*.mdx`, `messages/*.json`, comentarios o `docs/**` | extensión | **micro** |
| S14 | Cambia texto visible de UI o el layout de una ruta existente | diff en `*.tsx` bajo `app/` | ≥ **normal** + smoke |
| S15 | No clasificable | fallthrough | **normal** (nunca micro) |
| S16 | El gate de este cambio ya salió rojo una vez | contador en `.pandacorp/run/change-attempts.json` | **sube un nivel** |
| S17 | Dependencia inversa: un fichero del piso importa transitivamente un fichero tocado | `madge` (~3 s) | **critical** |

**Reglas de composición, las tres no negociables:**
1. **Máximo gana.** El nivel es `max(niveles disparados)`. Con 12 señales micro y una S5, es `critical`.
2. **Monótona hacia arriba.** Un agente puede **escalar** con una razón escrita en el card (`rigor_escalated_by`), **nunca bajar**. Espeja `pickWorkerModel` y CONV-12.
3. **Fail-closed en la duda.** Sin clasificación ⇒ `normal`. Sin diff legible o script roto ⇒ **`critical`**, porque un clasificador roto no puede degradar el rigor.

Lo que **no** hace: no decide bug vs feature (eso ya lo hace `change` paso 1), no decide urgencia, y no habla con el owner. Su salida se **muestra** ("clasificado como normal: 47 líneas, 4 ficheros, toca UI"), no se pregunta.

### A.3 Reparación inteligente

Hoy la reparación funciona pero es **ciega y cara**: `set -euo pipefail` hace que cada pasada muestre **un solo fallo**, el reviewer extrae los findings leyendo el log crudo, y cada ciclo interno de DR-107 vuelve a correr `knip`+`biome .`+`tsc` whole-project.

**Tres flags de ALCANCE en `verify.sh` (cero softening):**

| Flag | Qué hace | Quién lo usa | Invariante |
|---|---|---|---|
| `--report-all` | Acumula los fallos de los 9 sub-gates baratos (12,8 s) antes de abortar; los caros siguen cortando | el motor y el hook | El veredicto agregado sigue siendo **rojo**. Cada código de salida se captura explícitamente (`PIPESTATUS[0]`): **LESSON-0078 es exactamente el fallo que acecha aquí** |
| `--only=<gate[,gate]>` | Corre solo los sub-gates nombrados | **solo el bucle interno de auto-reparación** | Escribe `"scope":"partial"` y **NUNCA puede promover a `VERIFIED`** ni avanzar `last_green_sha`. Prohibido en el gate por-FRD y en el cierre |
| `--files=<lista>` | Acota biome a esos ficheros y vitest a `--related` | el bucle interno y L0 | ídem |

**El artefacto que falta: `.pandacorp/run/gate-report.json`**, escrito siempre (verde o rojo):

```json
{ "at": "...", "scope": "since|only|full", "green": false,
  "subgates": [
    {"name":"tsc","exit":2,"duration_ms":2509,
     "failures":[{"file":"src/lib/x.ts","line":42,"code":"TS2345","msg":"..."}]},
    {"name":"vitest","exit":1,"duration_ms":15400,
     "failures":[{"file":"src/lib/_tests/x.test.ts","test":"rejects empty id","msg":"..."}]}
  ]}
```

Resuelve **cuatro** problemas de golpe: (1) el reviewer deja de gastar turnos de opus parseando texto, los findings llegan ya en el shape que `attemptPatch` espera (`FINDINGS`, `:427-430`); (2) el hook deja de extraer rutas **por regex sobre el output** para la atribución DR-099, pasa a leer JSON; (3) da a Mission Control el `durationMs` por sub-gate (M-3/I-2); (4) hace medible el nivel de rigor aplicado (M-4). **No es un duplicado de A6: es su contrato de datos.**

**Cinco cambios en el motor:**
1. **Diagnóstico determinista primero.** Antes de `diagnoseFailure()` (opus, `:1412`), clasificar el fallo **desde el JSON**: `lint|types|deadcode|cycles|unit-test|e2e|structure|doc`. Los mecánicos (lint, tipos, estructura, ciclos) van a un agente **sonnet con `--only` + `--files`**. Solo lo no obvio escala a la escalera actual. Ojo: el JSON clasifica el **sub-gate**, no la culpa, y **no debe pisar** la distinción ya implementada `cause: 'gate-test-defective'` (LESSON-0002).
2. **Bucle interno acotado.** Los ≤2 ciclos de DR-107 corren `--only` + `--files`: **segundos en vez de 133 s por ciclo**.
3. **El re-gate final NO se acota.** Se mantiene literal el invariante de `:1103`. **Este es el límite duro de la propuesta.**
4. **Freno en dinero, no solo en intentos.** Si el gasto de reparar un cambio supera **3× el de construirlo**, el motor **para**. En FRD-24 fue 3,5× y nadie lo supo.
5. **Salida honesta.** Al agotarse cualquier freno: card a `status: needs-owner`, se adjunta el `gate-report.json` y el diagnóstico, **el trabajo se preserva en su rama**, y se avisa al owner por los dos canales de DR-099 (notificación + una línea en el chat, en español, diciendo qué está bloqueado, por qué, que nada se ha perdido y qué decisión hace falta). Nunca "lo intento una vez más".

**Impacto estimado sobre FRD-24:** `patch` 3,31 $ → ~1,6 $ y −3 a −5 min. **No es la palanca grande: es la que evita que un rojo cueste 3,5× el trabajo.**

### A.4 Gates incrementales y cadencia whole-repo

| Sub-gate | Coste | ¿Acotable? | Política |
|---|---:|---|---|
| structure, data-layer, RFC-9457, DR-100 | ~0,1 s | irrelevante | **Siempre whole-repo**, en los 3 niveles |
| doc-lint | 4,4 s | sí, pero no vale | **Siempre** (es el guardián de la doc proporcional) |
| biome | 1,0 s | sí | acotado en L0, whole en L1/L2 (por higiene de señal, no por tiempo) |
| tsc | 2,5 s | **no** | **Siempre whole.** Acotarlo es la trampa clásica |
| knip | 1,6 s | **no** | **Siempre whole** |
| madge | 3,1 s | **no** | **Siempre whole** |
| **vitest** | **82,3 s** | **sí** | acotado en L0/L1; whole en L2, cierre de FRD y nocturno |
| **Playwright** | **74,0 s** | por ruta | **`PANDACORP_GATE_ROUTES`**, leído por los specs igual que ya leen `e2e/_skip.ts`: **74 s → ~15 s** |

**Los 9 baratos suman 12,8 s: no se tocan nunca.**

**Cadencia whole-repo, el contrapeso que hace honesto todo lo anterior:**

| Momento | Qué corre | ¿Existe? |
|---|---|---|
| Por cambio (L0/L1) | el gate del nivel | no (es esta propuesta) |
| Cierre de FRD | `verify.sh` completo + `visual-qa` | **sí** (`:2102`) |
| Cierre de build / pre-release | completo + hardening | **sí** (`:2070-2145`) |
| **Nocturno, por proyecto activo** | `verify.sh` completo, **0 $ en tokens**, resultado a `dashboard-events.ndjson` | **no: J1-8** |

**El nocturno es el que compra el derecho a acotar.** Cualquier deriva que un gate acotado deje pasar aparece esa misma noche, atribuida al commit que la introdujo, sin que nadie pague un turno de espera. El mecanismo ya existe (tareas programadas del Desktop). Es también el hogar natural de BL-0126 (`next build` nunca corre en el gate): no se puede pagar por gate, sí una vez por noche.

**Paralelismo vitest + Playwright: NO se prioriza.** Playwright está en `workers:1` por determinismo, la contención de CPU puede volver flaky justo el gate más frágil, y `m4` observa una discrepancia sin explicar entre suma de partes (169 s) y reloj (107 s) que sugiere que algo ya se solapa. **Medir antes (I-2), decidir después.**

### A.5 Presupuesto de contexto por rol

| Rol | Presupuesto duro | Se inyecta SIEMPRE | Pasa a carga bajo demanda |
|---|---:|---|---|
| `classify-change` | **0 tok** (es un script) | — | — |
| `close-out` (haiku) | ≤12k | el card, `git diff --stat`, rutas de los WO tocados, esqueletos de los 3 templates | todo lo demás |
| `implementer` L0/L1 (sonnet) | ≤40k | su WO, los AC EARS verbatim, los Status Note de sus dependencias, `design-tokens.json` **solo si toca UI** | `frd.md` entero, `blueprint.md`, `architecture.md` (377 líneas), `components.md` (232), `DESIGN.md` (180) |
| `reviewer` L1 (opus, con techo) | ≤60k | `frd.md`, el **diff unificado**, `gate-report.json`, la lista de AC | el árbol. **El reviewer L1 no explora: juzga evidencia ya recogida.** Ahí está el 90 % del ahorro |
| `reviewer` L2 | sin techo | como hoy | — |
| dispatch mecánico | ≤8k | los argumentos | — |

**Mecanismo:** sustituir en los prompts la lista imperativa de ficheros a leer por un **manifiesto** (`ruta · para qué sirve · tamaño`) más "lee solo lo que los `artifacts` de tu WO requieran". Es prosa en `plugin/agents/*.md` y en los prompts del motor, no maquinaria.

**Net-new imprescindible:** que el motor **registre el tamaño de contexto inyectado por dispatch** en `track.jsonl`, para que el presupuesto sea verificable y no una buena intención. Sin gate (C-5), este eje se revierte por goteo: LESSON-0029 lleva **80 días como `candidate` con `times_applied: 0`**.

### A.6 Documentación proporcional y `close-out` en lote

| Artefacto | L0 | L1 | L2 |
|---|---|---|---|
| Card → `changes/done/` con `shipped_sha` + `shipped_at` | **Sí** | **Sí** | **Sí** |
| Línea en `.pandacorp/comms/progress.md` | Sí (1 línea) | Sí | Sí |
| Status Note del WO + `implementation_status` | No (no hay WO) | **Sí** | Sí |
| Entrada en `docs/decision-log.md` | **Solo si `supersedes:`** | **Sí** | Sí |
| FRD / blueprint / ADR / fdd | No | Solo si cambia un AC | **Sí** (cascada completa) |
| Rollups de `status.yaml` | en lote | en lote | como hoy |
| Chequeo de supersesión (DR-116) | solo si `supersedes:` | solo si `supersedes:` | Sí |

**Esto no debilita la regla de las dos escrituras: la operacionaliza.** La regla ya dice *"Don't record trivial changes already obvious from the commit"* pero nunca define trivial. **L0 es esa excepción, con criterio determinista (S1/S13)** en vez de con el juicio del momento.

**El `close-out` único.** Hoy el cierre está repartido en 5 agentes haiku: `sync-rollups` (0,072 $/45 s) + `commit`×2 (0,226 $/115 s) + `archive-changes` (0,060 $/34 s) + `notify-end` (0,093 $/186 s) = **0,45 $ y 380 s** en un run secuencial. Propuesta: **una sola llamada** que, con el gate en verde, (1) escribe los artefactos del nivel, (2) mueve el card a `done/` con `shipped_sha`, (3) hace **un commit con código + docs juntos** (la doble escritura se vuelve atómica), (4) anexa la línea de progreso y notifica. **~0,10 $ y ~60 s** (−0,35 $, −5,3 min).

**Y no es un skill nuevo: es el MODO CÁLIDO de `/pandacorp:sync`**, que existe exactamente para reconciliar código→docs (DR-081) y hoy solo se usa en frío y caro.

**El cerrojo sin el cual "en lote" significa "nunca":** si el cierre no llega a ocurrir (la sesión murió), el card queda en `status: closing` con `implemented_sha`, y **`doc-lint.sh` (ya dentro del gate, 4,4 s) pone en rojo un `closing` de más de 48 h**. La deuda documental deja de ser invisible y pasa a ser un gate.

### A.7 Metas numéricas y método del canario

**Objetivos pre-registrados y falsables:**

| Nivel | Coste end-to-end | Latencia (petición → mergeado + documentado) | Baseline de comparación |
|---|---:|---:|---|
| **L0 micro** | **≤ 0,50 $** | **≤ 10 min** | Hoy: **imposible por la fábrica** (BL-0129). Vía motor sería ~13-15 $ y ~45 min (*estimación compuesta* de partidas medidas: plan 0,23 + baseline 0,70 + build ~0,4 + gate 6,51 + visual-qa 5,50 + plumbing 0,74) |
| **L1 normal** | **≤ 2,50 $** | **≤ 20 min** | **10,43 $/WO · 32,4 min/WO** (medido) |
| **L2 critical** | sin objetivo de ahorro: **no empeorar** | — | 10,43 $/WO tras E-3 + E-4 |
| **Agregado** | review/gate baja de **70 % a ≤40 %** del coste de un build | — | `s8 §A.3` |
| **Freno** | reparar un cambio nunca supera **3× construirlo** | — | en FRD-24 fue **3,5×** y nadie lo vio |

**Método, con lo que ya existe:**
1. **Instrumento.** Extender `usage-rollup.mjs` a un rollup **por cambio**. **Prerrequisito duro: I-1** (sin coste por etapa y sin cache-write tarifado, cualquier "ahorro" es indemostrable).
2. **Backtest del clasificador (gratis, hoy mismo, y es el canario más fuerte).** Correr `classify-change.sh` sobre los **últimos 200 commits** de los tres repos (hay 918 disponibles) y revisar a mano **todos** los que clasifique `micro`. Criterio: **cero** commits que tocan el piso clasificados por debajo de `critical`. Determinista, 0 $, repetible en cada cambio del clasificador.
3. **Canario L0.** Re-ejecutar por el camino nuevo un cambio histórico conocido (el fix CSS de 8 líneas). Aceptación: ≤0,50 $ / ≤10 min **y** el decision-log correcto (hoy ese cambio no dejó ninguna entrada).
4. **Canario L1.** Drenar el card real de **76 días**. Aceptación: ≤2,50 $ / ≤20 min, card en `done/`, **y el gate nocturno completo de esa misma noche en verde** (prueba de que el gate acotado no dejó pasar deriva).
5. **Canario de residual.** El card `decision-id-shared-emitter.md` debe quedar archivado con el `shipped_sha` de FRD-24.
6. **Criterio de adopción, el único que decide si esto sirvió.** ≥**1 cambio por semana** entrando por el camino nuevo durante 4 semanas, en ≥2 proyectos. **Si el coste baja y la adopción no sube, el diseño falló** y toca captura pasiva (BL-0064).

### A.8 La opción radical, evaluada en serio

**La pregunta:** ¿y si el camino por defecto fuera el flujo directo del owner, y la fábrica solo aportara captura, clasificación, gate al cierre y documentación en lote?

| | **A: niveles dentro del motor** | **B: directo por defecto + cierre asistido** | **C: híbrido (B para L0/L1, A para L2 y lotes)** |
|---|---|---|---|
| Latencia owner→código | minutos, **si alguien lanza `/implement`**; en MC hoy imposible | **el mismo turno** | mismo turno (L0/L1); diferida y desatendida (L2) |
| Coste L0 estimado | ~1-2 $ (sigue pagando plan + baseline + plumbing) | **~0,25 $** | ~0,25 $ |
| Coste L1 estimado | ~2-3 $ | **~1,5 $** | ~1,5 $ |
| Oráculo independiente (DR-015) | sí, siempre | sí en L1; en L0 el oráculo es el **script canónico** | igual que B, y **completo** en L2 |
| Documentación | máxima | proporcional, en lote | proporcional o máxima según nivel |
| Trabajo desatendido / nocturno / multi-FRD | **sí, es su razón de existir** | **no** | **sí**, vía A |
| Escalera de recuperación, olas, lease | sí | no | sí donde importa |
| Coste de implementación | **2-3 semanas** de motor | **~1 semana** | ~1 semana + incremental |
| Riesgo de romper el ejecutor nocturno | medio-alto | **nulo** (no se toca el motor) | bajo |
| ¿Resuelve la causa raíz de la no-adopción? | **No** | **Sí** | **Sí** |

**El dato que decide:** `/change` no produce código y en MC no puede producirlo (verificado en §0b). **Ninguna optimización de coste cambia eso.** Y hay precedente de que B funciona: `changes/done/manual-multi-runtime-diagram.md` lleva `shipped_note: "implemented directly in-session at the owner's request, not drained by a build"`. Y el propio FRD-24, el build que sirve de baseline, **fue híbrido**: `docs/decision-log.md:85` dice *"Ran the `iterate` PM step by hand on the queue's card"*. **El camino puro de fábrica no se usó ni en el caso que estamos midiendo.**

**Decisión propuesta: C, con B como puerta por defecto.** `/pandacorp:change --now` (flag, no comando nuevo), y `--now` es el **default cuando el clasificador devuelve L0 o L1** y no hay build activo:

```
owner: "el borde de la card de portada debería ser recto"
  │
  ├─ 1. classify-change.sh sobre el diff/las rutas       → L0    [0 $, <1 s, script]
  ├─ 2. escribe el card en la cola (como hoy)                    [~0 $]
  ├─ 3. DELEGA la implementación a un subagente acotado          [~0,15 $]
  │      (tier por CONV-12; NUNCA en la sesión del owner: un turno
  │       suyo cuesta 0,11 $, el subagente arranca limpio)
  ├─ 4. gate del nivel (verify.sh --only/--files)                [0 $, ~30 s]
  ├─ 5. close-out en lote: docs del nivel + 1 commit + card→done [~0,10 $]
  └─ 6. una línea al owner: "hecho, nivel micro, gate verde, card archivada"
TOTAL ≈ 0,25 $ · ~5 min · sin ceremonia visible
```

**Las tres válvulas de seguridad, sin las cuales esto es una mala idea:**
1. **Si el clasificador devuelve L2, `--now` se niega.** Explica qué señal del piso disparó, deja el card en la cola y ofrece `/implement`. El camino rápido **no puede** tocar auth, pagos, datos, migraciones, secretos, CI ni los oráculos.
2. **Si hay un build activo (`running: true` + heartbeat fresco), `--now` se niega** y cae a captura pura. El motor es el escritor único mientras corre.
3. **DR-015 se respeta explícitamente:** en L1 el reviewer es otro agente **y** otro modelo que el implementador. En L0 el oráculo es el `verify.sh` canónico, que **no lo escribió quien implementó** (viene verbatim del template y su drift es rojo).

**Qué se queda el motor, y por qué sigue siendo imprescindible:** lo desatendido y lo grande. Olas cross-FRD, escalera de recuperación, lease en dos fases, presupuesto ponderado, contrato nocturno con supervisor. **B no lo sustituye: le quita de encima el trabajo para el que estaba sobredimensionado.** Un build de 5 WOs de noche sigue siendo el caso donde 20,86 $ es un precio razonable; un borde de card de 8 líneas nunca lo fue.

---

## BLOQUE B · El resto de la fábrica (resumen)

### B.1 `spec` y la fase de producto

**Por qué no se usa, con cuatro datos:** (1) **8 de 11 proyectos** nunca entraron al mecanismo (solo MC, personal-page-v2 y pandacast tienen `status.yaml`), y los otros 8 inventaron ocho convenciones de documentación distintas: el owner no es reacio a documentar, es reacio a documentar así; (2) **`spec` no tiene suelo de coste** (los flags `--ask/--auto/--infer` regulan cuántas preguntas se hacen, nunca cuánta documentación sale: 40-60 ficheros antes de la primera línea de código); (3) **el motor apenas lee lo que spec produce** (`grep -ni "prd"` sobre las 2.146 líneas del motor devuelve **1** resultado, y es un comentario de paso); (4) **la adopción se cortó en seco el 2026-07-10** y `pandacast` quedó congelado en `phase: design` mientras su repo siguió recibiendo commits hasta el 16 de septiembre: **no abandonó el proyecto, abandonó el mecanismo**.

**`spec --micro` (S-1):** scaffold completo sin recortar + **un** fichero `docs/product/spec.md` (problema, no-goals, 3-8 AC en EARS, modelo de datos mínimo, un ejemplo trabajado) + la `frd.md` generada desde él con solo lo que el motor consume. **Una sola gate humana.** Techo duro: ≤1 FRD, ≤3 WOs; si el planificador necesita más, **para** y propone el spec completo. **Invariante:** lo que el motor consume mecánicamente (frontmatter de WO, EARS, Build Plan) no cambia de forma, así que un proyecto micro puede promocionarse sin reescribir contratos.

**Efecto colateral que hay que nombrar:** `review-launch` es hoy **inalcanzable por construcción** (0 proyectos en `phase: release`), pese a tener una rutina semanal dedicada. **Arreglar la entrada sin arreglar la salida solo ensancha un embudo que sigue sin desembocar** (S-8: verificar el artefacto en producción, no el campo `phase`).

### B.2 Skills: veredicto y mapa de 11 front doors

**Nada que borrar:** los 26 skills tienen invocador o rol interno. Lo que sobra es **prosa duplicada entre hermanos** y **front doors ambiguos**. Peor caso verificado: el preflight de `overlay_version`/build-running está copiado **casi verbatim en 5 ficheros** (`change`, `iterate`, `bug`, `new-version`, `sync`), ~120 palabras × 5, sin un puntero compartido (S-7).

Veredictos: `spec` aligerar con `--micro` · `discover` aligerar drásticamente (4.726 palabras, 0 referencias a standards, todo el scoring inlineado y duplicado con `new-idea`) · `new-idea`+`explore` **fusionar** en `/pandacorp:idea` (la frase *"I have an idea"* dispara ambos hoy) · `work-orders` plegar en `architecture` · `adopt` delegar por invocación, no por prosa reescrita · `memory` y `absorb` a sub-modos de `learn` · `recommend` es el modelo a imitar (459 palabras, 0 DR, hace una cosa) · el resto, mantener.

**De 21 slash commands visibles a 11**, agrupados por intención: cambiar, construir, decidir, idear, descubrir, recomendar, arrancar, diseñar/arquitecturar, lanzar, aprender, mantener.

### B.3 Agentes

- **`copywriter` opus → sonnet** tras canario A/B ciego (G-1): el pin más flojo de los 5 opus y **fuera del camino caliente**, así que el canario es casi gratis.
- **`test-writer` escala con el WO** (G-3): hoy el código escala a opus en un WO difícil y su test de aceptación no. Solo aplica al modo `deep`.
- **Agente `pandacorp:mech`** (~8 líneas, tools `Bash, Read`) para los 14 sitios MECH (G-2): grant mínimo y prompt mínimo en vez de inyectar `implementer.md` entero para ejecutar `git rev-parse`. **Se cancela si se adopta E-2a.**
- **`product-manager`**: "grepea `DR-` en el registry" en vez de "consulta el registro de decisiones" de 706 líneas (G-4, 15 minutos).
- **No tocar:** `architect`, `designer`, `reviewer` (estructural por DR-015), el bloque DR-047 duplicado byte a byte en 6 agentes (deliberado y protegido por el gate de drift).

### B.4 Standards y `docs/rules`

**El peso NO está en `factory/standards/`**: ninguna skill ni agente manda leer un standard entero, el patrón universal es citar el DR puntual. El peso está en la cadena de `@import`.

- **C-1:** cargar por ruta el clúster tech de `docs/rules` (`.claude/rules/*.md` con `paths:`), como proyección generada del mismo template. **−3.975 tokens (−17,2 %)**. El vehículo ya está especificado en `docs/proposals/34` (status `proposed`, **sin cierre en ningún decision-log**, y **no existe ningún directorio `.claude/rules/`**: no adoptada).
- **C-2 (net-new frente a la 34):** mover las secciones operativas de `panda-corp/AGENTS.md` a `.claude/rules/factory-operations.md` con `paths: ["plugin/**","factory/**"]`. **−3.500 a −4.400 tokens (−15 a −19 %)** en toda sesión de producto de MC.
- **C-3:** desduplicar DR-009/DR-110/DR-111 entre `AGENTS.md` y `guide.md` (la frase final de DR-009 es **byte-idéntica** en ambos). **−1.100 tokens (−4,7 %)**.
- **C-4:** partir `build-orchestration.md` (1.402 líneas) en contrato / internos / narrativa. **0 tokens de sesión**: es palanca de **auditabilidad**, y es la razón de que cueste tanto modificar el motor.
- **C-5:** promover LESSON-0029 a regla con gate (techo de líneas del always-loaded layer). **Sin esto, C-1/C-2/C-3 se revierten por goteo.**
- **C-6:** fusionar `background-jobs.md` en `resilience.md` y marcar los otros dos como no inyectables. **No borrar** (corrige a `s5`).

**Nota honesta:** a precio de cache-read, recortar 8.600 tokens en una sesión de 322 llamadas ahorra ~**0,55 $**. **La dieta de contexto es palanca de atención y calidad, no de dinero.**

### B.5 Hooks

- **A1 · fast-path de árbol limpio en `verify-before-stop.sh`:** salir 0 si `git status --porcelain` está vacío **y** `HEAD` coincide con el sha de la última ejecución verde **y** el registro `.touched` de esta sesión está vacío. Fail-closed en la duda. **−10 a −31 min de latencia por sesión** (estimación: el nº real de Stops no está medido). **La mayor palanca de tiempo del bloque B.**
- **A2 · acotar `check-derived-drift.sh`** a sesiones que tocaron `plugin/`: elimina 5-6 procesos `node` + copias de árbol en cada Stop de cada sesión de MC. Relacionado con BL-0044.
- **A3 · corrección al enunciado:** mover el registro `.touched` después de las exenciones **rompería** la atribución fail-closed de DR-099 (el propio script lo documenta). Lo que sí se puede es cachear la resolución del root. Prioridad baja.
- **A4 · conectar los 9 `test-*.sh` al runner** (`run-engine-tests.sh:22` descubre solo `test-*.mjs`). Son justo los tests del gate de comandos peligrosos, de la atribución de sesión y del backup. **Una línea.** Si algo sale rojo, **eso es el hallazgo**.
- **A5 · higiene:** cabecera `SUSPENDED_BY_DR-120` en los 2 scripts de canario de Codex; aclarar dónde vive `test-whole-frd-gate-contract.mjs`.
- **A6 · `--report-all`:** se **fusiona con J1-3** en un solo cambio (ver §4).

### B.6 Motor

**E-1 (spike de 30 min, bloqueante para dos ramas):** ¿el runtime de Dynamic Workflows expone shell y/o `EnterWorktree`/`ExitWorktree`?
**E-2a (si sí):** colapsar los 14 sitios MECH a código. **−0,74 $ (−3,5 %) y −9,3 min (−14,3 % del reloj)**, y elimina una clase de fallo entera. **Por lotes**, empezando por los inocuos y **dejando `commit`/`apply-gate`/`release-lease` al final o fuera.**
**E-2b (si no):** `effort: 'minimal'` en los 14 sitios MECH. El motor nunca usa los dos rungs bajos de los cinco.
**E-3:** **re-tier `visual-qa` de opus a sonnet: −3,30 $ = −15,8 % del build.** Es un veredicto **advisory por decisión propia de la fábrica** (DR-072) pagado al tier más caro. Se **amplía BL-0108** con este sitio, no se abre un BL nuevo.
**E-4:** `visual-qa` como promesa de fondo concurrente con el hardening: **−761 s (−12 min, −19,6 % del reloj)**. Nada depende de su resultado.
**E-5:** arreglar el pre-check del baseline DR-067 (BL-0124): **−0,76 $ (−3,6 %) y −252 s**, con dato real de un run.
**E-6:** cerrar BL-0098 (¿`budget.spent()` ya cuenta subagentes?) + BL-0109 (peso de opus 3× → 2,5×): el freno frena ~20 % antes de lo debido.
**E-7:** evaluar `/code-review --ultra` como *finder* dentro de `frdGateSplit`, **conservando el schema propio y la trazabilidad EARS como post-proceso**, nunca como sustituto del veredicto. Alto riesgo: toca el oráculo.
**E-8:** plegar la renovación del lease al bucle de `Monitor` (BL-0131): evita builds nocturnos que mueren en silencio.

### B.7 Mission Control

Punto de partida verificado: `grep -rln "cost_usd|costUsd|usage_summary" mission-control/src/` devuelve **cero**. **MC no muestra coste en ninguna parte**, pese a que `track.jsonl` lleva un `usage_summary` completo desde el 3 de septiembre.

**M-1** coste por etapa y agente en La Fragua · **M-2** coste real vs medido (cache-write) · **M-3** tiempo por sub-gate · **M-4** nivel de rigor por cambio · **M-5** concurrencia real vs `maxAgents` · **M-6** coste de las sesiones manuales · **M-7** latencia acumulada de hooks · **M-8** antigüedad de la cola · **M-9** proyectos sin `status.yaml`. **M-1, M-2 y M-3 son prerrequisito de gobierno.**

### B.8 Capacidades nativas infrautilizadas

**N-1** `experimental: {cacheTtl: "1h"}` en `plugin/agents/reviewer.md` (nunca global): potencialmente la mayor palanca de $, pero **indemostrable sin I-1**, porque el medidor no factura el cache-write que esta palanca reduce. BL-0118 se cerró sin adoptarla.
**N-2** PROMPT-9 en `prompting-conventions.md`: prefijo estable primero, variable después. Hoy PROMPT-8 empuja en contra sin quererlo.
**N-3** = E-2b (rungs bajos de effort).
**N-4** = E-7 (`/code-review --ultra`).
**N-5** = C-1/C-2 (rules por ruta).
**N-6** = E-4 (`visual-qa` en background).

---

# FASE 4 · Plan

## 4.1 Tabla única (J1 + J2 fusionados)

Solapes resueltos explícitamente en la última columna.

| id | Propuesta | Impacto estimado | Coste | Riesgo | Revers. | ¿1 día? | BL / LESSON / solape |
|---|---|---|---|---|---|---|---|
| **J1-1** | `safePoint()` antes de la salida `plan.frds.length === 0` | **0 $ directo. Desbloquea 2 cards en MC (uno de 76 días) y 4 en PPv2.** Sin esto todo lo demás es teórico | 2-4 h | Bajo | Sí | **Sí** | **BL-0129** (open, p1) · LESSON-0113 |
| **J1-2** | `classify-change.sh` + campo `rigor` + backtest de 918 commits | 0 $ directo; **habilita J1-4/5/7**. El backtest cuesta 0 $ | 1-2 d | Medio | Sí | No (el script sí) | net-new |
| **J1-3** | `gate-report.json` + `--report-all` | −1 a −3 ciclos de reparación (−2 a −7 min cada uno). Habilita I-2/M-3/M-4 y la atribución DR-099 sin regex | 4-6 h | Bajo | Sí | **Sí** | **fusiona A6 en UN cambio** · LESSON-0078 |
| **J1-4** | Niveles de rigor en el LLAMADOR (Stop + `--now`) | 0 $ · **−103 s por Stop con edición**. **Apila sobre A1**: juntas ≈ −40 min/sesión | 4-6 h | Medio | Sí | **Sí** | **complementa A1, no la sustituye** |
| **J1-5** | Reviewer L1 con evidencia pre-digerida + techo de turnos | **−5,81 $ (−27,9 %)** si se aplica al gate por-FRD (6,51 → ~0,70 $) | 1-2 d + canario | **Alto** (R2) | Sí | No | net-new · **eje distinto de E-3**: E-3 baja el *tier* de un veredicto advisory, esto recorta el *bucle* del bloqueante sin tocar su tier |
| **J1-6** | `close-out` en lote como **modo cálido de `/sync`** | −0,35 $ · −5,3 min. En el camino directo **es lo único que hace que la doc exista** | 1 d | Bajo | Sí | No | **se solapa con E-2a**: si E-1 = sí, E-2a cubre el camino del motor y J1-6 queda solo para el directo |
| **J1-7** | `/pandacorp:change --now` (flag) | **micro: ~13-15 $ → ~0,25 $ y ~45 → ~5 min** · **normal: 10,43 $/WO → ~1,5 $ y 32 → ~15 min** (*estimaciones compuestas*). **Decide la adopción** | 3-5 d | Medio | Sí (es un flag) | No | net-new · fallback pasivo = **BL-0064** |
| **J1-8** | Gate nocturno completo por proyecto activo, no bloqueante | **0 $ en tokens.** Es el contrapeso que **legitima acotar** | 2-3 h | Bajo | Sí | **Sí** | hogar natural de **BL-0126** · riesgo de BL-0037/0049/0133 |
| **J1-9** | `--only`/`--files` + reparación dirigida + freno 3× + salida honesta | patch 3,31 → ~1,6 $ y −3 a −5 min; **evita que un rojo cueste 3,5× construir** | 1-2 d | **Medio-alto** (R1: jaula `scope:partial` obligatoria) | Sí | No | familia de **BL-0110** · canario = **BL-0063** |
| **J1-10** | Presupuesto de contexto por rol + manifiesto + registro por dispatch | **−1 a −3 $/build** estimado. **No medido** | 1-2 d | Medio | Sí | No | **distinto de C-1/C-2/C-3** (ellas: prefijo de sesión; esto: contexto inyectado) · gate = C-5 / LESSON-0029 |
| **J1-11** | Cierre honesto del card (`closing` + `implemented_sha` + doc-lint 48 h + edad visible) | Cierra el residual de FRD-24 y hace imposible otro card de 76 días invisible | 1 d | Bajo | Sí | **Sí** (la parte de doc-lint) | **BL-0046**, **BL-0132** · M-8 |
| **J1-12** | Playwright acotado por RUTA (`PANDACORP_GATE_ROUTES`) | **74 s → ~15 s** por gate con navegador | 4-6 h | Medio | Sí | **Sí** | net-new, extiende DR-106 |
| **J1-13** | Rollup de coste POR CAMBIO (camino directo) | 0 $ directo. **Sin esto, las metas de A.7 no son verificables** | 1 d | Bajo | Sí | No | **depende de I-1** · BL-0107/0123/0096 · M-6 |
| **I-1** | Coste por etapa/agente **y cache-write real** | Habilita medir E-3, N-1, E-5. Hoy el medidor omite 2,59 M tokens | 1-2 d | Bajo | Sí | No | **BL-0107**, BL-0123, BL-0096 |
| **I-2** | `durationMs` por sub-gate en el stream | Prioriza vitest vs Playwright con datos | 1 d | Bajo | Sí | No | depende de J1-3 |
| **A1** | Fast-path de árbol limpio en el Stop | **−10 a −31 min/sesión.** 0 $ | 2-4 h | Medio | Sí | **Sí** | BL-0005, LESSON-0040 |
| **A2** | Acotar `check-derived-drift.sh` a `plugin/` | 5-6 procesos `node` menos por Stop en toda sesión de MC | 1-2 h | Bajo | Sí | **Sí** | **BL-0044**, BL-0082 |
| **A3** | Cachear la resolución del root (**NO** mover `.touched`) | Marginal | 1 h | Bajo | Sí | **Sí** | DR-099 |
| **A4** | **Conectar los 9 `test-*.sh` al runner** | 0 $. Arnés de los mecanismos que A1/A2/A3 van a tocar | 1 h + arreglar rojos | Bajo (el rojo es el hallazgo) | Sí | **Sí** | **LESSON-0151/0184** |
| **A5** | `SUSPENDED_BY_DR-120` + aclarar el test huérfano | Higiene | 15 min | Nulo | Sí | **Sí** | DR-120 |
| **E-1** | **Spike: ¿shell y worktrees nativos desde un Workflow?** | Decide E-2a vs E-2b y el futuro de ~150 líneas | 0,5-1 h | Nulo | N/A | **Sí** | net-new |
| **E-2a** | Colapsar los 14 sitios MECH a código (si E-1 = sí) | **−0,74 $ y −9,3 min** | 6-10 h | **Alto** en commit/apply-gate/release-lease | Sí | No | **BL-0063** · cancela G-2 |
| **E-2b** | `effort: 'minimal'` en MECH (si E-1 = no) | Fracción de E-2a, no medible sin correrlo | 1 h | Bajo | Sí | **Sí** | prop. 33 R-06 |
| **E-3** | **`visual-qa` opus → sonnet** | **−3,30 $ (−15,8 %)** | 1 h + 1 build de canario | **Medio** (R3) | Sí (1 línea) | **Sí** | **ampliar BL-0108** · prop. 33 R-11 |
| **E-4** | `visual-qa` en background | **−761 s (−19,6 % del reloj)** | 4-6 h | Medio | Sí | No | net-new · DR-072 |
| **E-5** | Arreglar el pre-check del baseline DR-067 | **−0,76 $ y −252 s** | 2-4 h | Bajo | Sí | No | **BL-0124** |
| **E-6** | Cerrar BL-0098 + BL-0109 | El freno frena ~20 % antes de lo debido | 4-6 h | Bajo | Sí | No | **BL-0098** (doing), **BL-0109** |
| **E-7** | `/code-review --ultra` como finder en el gate split | No medible sin correrlo (hasta 13 `agent()` por FRD) | 2-3 d + canario | **Alto** | Parcial | No | net-new |
| **E-8** | Renovación del lease en el bucle de `Monitor` | Evita builds nocturnos que mueren en silencio | 3-4 h | Bajo | Sí | No | **BL-0131** |
| **C-1** | Piloto de rules por ruta | **−3.975 tokens (−17,2 % del prefijo)** | 1-2 d | Medio | Sí | No | **proposals/34** (sin cerrar), LESSON-0029 |
| **C-2** | `factory-operations.md` con `paths:` | **−3.500 a −4.400 tokens** en sesiones de producto de MC | 4-8 h | Medio | Sí | No | net-new sobre la 34 |
| **C-3** | Desduplicar DR-009/110/111 | **−1.100 tokens (−4,7 %)** | 2 h | Bajo | Sí | **Sí** | precedente **BL-0095** |
| **C-4** | Partir `build-orchestration.md` | 0 tokens: **auditabilidad** | 1 d | Bajo | Sí | No | net-new |
| **C-5** | Gate de presupuesto de contexto | Impide que C-1/C-2/C-3 se reviertan por goteo | 3-4 h | Bajo | Sí | No | **LESSON-0029** (80 días, 0 aplicaciones) |
| **C-6** | Fusionar `background-jobs.md`; marcar no inyectables | Higiene. **No borrar** | 1 h | Nulo | Sí | **Sí** | net-new |
| **N-1** | `cacheTtl: 1h` en el reviewer | **Potencialmente la mayor palanca de $**, hoy indemostrable | 0,5 h + 1 build | Medio | Sí | No | **BL-0118** (cerrado sin adoptar) · **depende de I-1** |
| **N-2** | PROMPT-9 (prefijo estable primero) | 0 directo; habilita N-1 | 1-2 h | Bajo | Sí | **Sí** | net-new |
| **S-1** | **`spec --micro`** | **Desbloquea los 8/11 proyectos fuera de la fábrica** | 2-3 d | Medio (R7: puede trasladar coste al gate) | Sí | No | net-new · DR-095/DR-100 |
| **S-2** | `explore` + `new-idea` → `/pandacorp:idea` | −1 front door | 4-8 h | Bajo | Sí | No | net-new |
| **S-3** | `memory`/`absorb` a internos | −2 front doors | 1 h | Bajo | Sí | **Sí** | net-new |
| **S-4** | `work-orders` → `architecture` | −1.402 palabras en dos sitios que ya divergen | 4 h | Bajo | Sí | No | net-new |
| **S-5** | Extraer el scoring `discover`↔`new-idea` | −30/−40 % del skill más grande | 1 d | Bajo | Sí | No | net-new |
| **S-6** | `adopt` delega por invocación | −25/−35 % de 3.603 palabras | 1 d | Bajo | Sí | No | net-new |
| **S-7** | Un preflight compartido en vez de 5 copias | ~600 palabras duplicadas sin gate | 3 h | Bajo | Sí | **Sí** | precedente **BL-0095** |
| **S-8** | `review-launch` verifica producción, no `phase:` | Hoy la rutina semanal corre sobre **cero** proyectos | 2-4 h | Bajo | Sí | **Sí** | **BL-0087** |
| **G-1** | Canario A/B ciego `copywriter` opus→sonnet | El pin más flojo, fuera del camino caliente | 1 h | Bajo | Sí | **Sí** | prop. 33 §7 |
| **G-2** | Agente `pandacorp:mech` | Grant y prompt mínimos. **Se cancela si E-2a** | 2 h | Bajo | Sí | **Sí** | net-new |
| **G-3** | `test-writer` escala con el WO | Calidad en modo `deep` | 1 h | Bajo | Sí | **Sí** | prop. 33 R-09 |
| **G-4** | `product-manager`: grep del registry | Menor coste de arranque nominal | 15 min | Nulo | Sí | **Sí** | net-new |
| **M-A** | Resto de superficies de MC (M-4..M-9) | Gobierno | 2-3 d | Bajo | Sí | No | **BL-0125** |

## 4.2 Fases

### Fase 0 · Quick wins de un día (orden obligado)

**A4 va PRIMERO**, sin excepción: son los tests de los hooks que A1/A2/J1-4 van a modificar y hoy no los ejecuta nadie. Modificar un gate de seguridad sin su arnés conectado es exactamente el patrón de LESSON-0184.

```
1. A4     conectar los 9 test-*.sh al runner       ── arnés ANTES de tocar nada
2. J1-1   safePoint() en la salida de plan vacío   ── sin esto, /change sigue siendo papel
3. J1-11  cierre honesto del card + doc-lint 48 h  ── cierra el residual y el card de 76 días
4. J1-3 + A6  gate-report.json + --report-all      ── UN solo cambio, no dos
5. J1-8   gate nocturno                            ── el contrapeso, ANTES de acotar nada
6. A1     fast-path de árbol limpio en el Stop     ── la mayor palanca de TIEMPO
7. E-1    spike de primitivas del runtime (30 min) ── decide E-2a vs E-2b y el bloque C2
8. E-3    visual-qa a sonnet                       ── la mayor palanca de COSTE (−15,8 %)
9. A2     scope de check-derived-drift a plugin/
10. C-3   desduplicar AGENTS ↔ guide               ── −4,7 % del prefijo
11. S-3 · S-7 · G-4 · A5 · C-6 · N-2 · G-1 · G-3
12. E-2b  effort minimal en MECH (solo si E-1 = no)
```

**Resultado esperado al cerrar Fase 0:** −15,8 % de $/build, −10 a −31 min/sesión manual, −4,7 % del prefijo, la cola drenable por primera vez, 21 → 19 front doors.

### Fase 1 · El camino de cambio + instrumentar (2 semanas)

```
I-1  coste por etapa + cache-write real       ┐ prerrequisitos
I-2  durationMs por sub-gate (desde J1-3)     ┘ de gobierno
J1-2 classify-change.sh + backtest de 918 commits
J1-4 niveles en el llamador (Stop + --now)    ── DESPUÉS de A4 y J1-3
J1-12 Playwright por ruta
J1-6 close-out como modo cálido de sync
J1-13 rollup por cambio                       ── DEPENDE de I-1
J1-7 change --now                             ── DEPENDE de J1-2, J1-4, J1-6
E-5 BL-0124 · E-6 BL-0098/0109 · E-8 BL-0131 · S-8 BL-0087
N-1 cacheTtl en el reviewer                   ── DEPENDE de I-1
G-2 pandacorp:mech                            ── CANCELAR si E-1 = sí
→ CANARIOS de A.7 (backtest · L0 histórico · L1 con el card de 76 días · residual)
```

### Fase 2 · Cambios de forma (semanas, con canario)

```
J1-9  --only/--files + reparación dirigida + freno 3×   ── jaula scope:partial
J1-10 presupuesto de contexto por rol                   ── + C-5 para fijarlo
J1-5  reviewer con techo de turnos     ── LA ÚLTIMA: la más arriesgada y la más golosa
E-2a  colapsar plumbing a código (si E-1 = sí), por lotes, dejando commit/apply-gate/
      release-lease al final o fuera
E-4   visual-qa en background
C-1 → C-2 → C-5   (rules por ruta, raíz de la fábrica, gate de presupuesto)
S-2 · S-4 · S-5 · S-6 · M-A
```

### Estructural · decisión del owner, no un sprint

```
S-1  spec --micro          ← la única propuesta que cambia QUIÉN usa la fábrica
E-7  /code-review nativo en el gate split   ← toca el oráculo; solo con canario largo
C-4  partir build-orchestration.md
META: qué hacer con product→design→architecture, dado que 8/11 proyectos viven fuera
      y 0 llegan a release. Arreglar la entrada (S-1) sin la salida (S-8) solo ensancha
      un embudo que sigue sin desembocar.
```

## 4.3 Grafo de dependencias

```
A4 ─────▶ A1, A2, A3, J1-4        (arnés antes de tocar hooks)
J1-1 ────▶ (todo lo demás tiene sentido)
J1-3 ────▶ J1-9, I-2, M-3, M-4    (el gate-report es el contrato de datos)
J1-2 ────▶ J1-4 ────▶ J1-7
J1-6 ────▶ J1-7                   (se reduce de alcance si E-1 = sí ⇒ E-2a)
J1-8 ────▶ J1-4, J1-12            (el nocturno legitima acotar: va ANTES)
J1-11 ───▶ J1-7                   (un camino que no cierra cards repite el residual)
I-1 ─────▶ J1-13 ──▶ medir J1-5, J1-9, J1-10 · y N-1 · y confirmar E-3/E-5
E-1 ─────▶ E-2a (sí) ──▶ cancela G-2
     └───▶ E-2b (no)
E-3 ─────▶ E-4                    (re-tierar antes de mover de sitio)
C-1 ─────▶ C-2 ─────▶ C-5
S-1 ◀────┐
S-8 ─────┘                        (entrada y salida del pipeline, juntas)
```

## 4.4 Escenario agregado (ESTIMACIÓN, no medición)

Re-corriendo un FRD-24 equivalente con las palancas de ambos bloques:

| Palanca | Δ$ | Δmin |
|---|---:|---:|
| E-3 `visual-qa` a sonnet | −3,30 | 0 |
| E-4 `visual-qa` en background | 0 | −12,7 |
| E-5 pre-check de baseline (BL-0124) | −0,76 | −4,2 |
| E-2a plumbing a código (si E-1 = sí) | −0,74 | −9,3 |
| J1-5 reviewer con evidencia pre-digerida | −5,81 | −10 |
| J1-9 reparación dirigida + freno | −1,70 | −4 |
| J1-6 close-out en lote | −0,35 | −5,3 |
| J1-10 presupuesto de contexto (conservador) | −1,00 | −2 |
| J1-12 Playwright por ruta | 0 | −2 |
| **TOTAL** | **≈ −13,7 $** | **≈ −49,5 min** |
| **Resultado** | **≈ 7,2 $ (−65 %)** | **≈ 15 min (−77 %)** |

**Estimación compuesta.** Y el aviso importante: **esto es el camino del MOTOR mejorado**. El camino directo para un cambio micro no pasa por casi ninguna de estas partidas: ahí el número relevante es **≈0,25 $ y ≈5 min**, y el ahorro no viene de optimizar nada, sino de **no invocar la máquina grande para un trabajo pequeño**.

## 4.5 Si solo se puede hacer una cosa

**J1-1.** Dos a cuatro horas, riesgo bajo, un BL ya escrito con su test. Hoy la puerta única de la fábrica escribe un fichero que, en el proyecto insignia, **es estructuralmente imposible de drenar**. Mientras eso siga así, ninguna optimización de coste va a cambiar la conducta del owner, y todo lo que construyamos encima hereda el mismo callejón sin salida.

**Si se pueden hacer dos:** J1-1 + **E-3** (una línea, −15,8 % del coste del build). **Si tres:** las dos anteriores + **A4** (el arnés que protege todo lo demás).

---

# 5. Cruce con el backlog y las lecciones

**Regla que nos impusimos:** nada se propone como nuevo si ya hay un BL o una LESSON que lo cubre.

## 5.1 Ya registrado: la propuesta es "ejecutarlo", no "inventarlo"

| Propuesta | Ya existe como | Estado | Qué aporta este memo |
|---|---|---|---|
| J1-1 | **BL-0129** (*"Bare /implement's empty-plan early exit never drains the DR-069 ready-changes queue"*) | `open`, **p1**, abierto el 13-sep, reproducido en PPv2 el 11-sep | **Verificación net-new en MC** (106/106 VERIFIED ⇒ rama rota permanente, 2 cards atrapados) y la **reclasificación**: no es un bug p1 de motor, es **la causa raíz de la no-adopción de `/change`** |
| J1-11 | **BL-0046** (transitorio `building` + residual del hilo de archivado) y **BL-0132** (FRD/WOs que quedan `DRAFT` para siempre) | ambos `open` | Evidencia dura: `archive-changes` **corrió** (0,06 $) y el card sigue `ready`; último archivado real, julio. El cerrojo `closing` + doc-lint 48 h es nuevo |
| J1-7 (fallback) | **BL-0064** (nudge advisory hacia `/sync` tras ediciones a mano, fire-once, nunca bloquea) | `open`, p2, desde el 10-jul | Es el plan B de R10: si el owner no adopta un comando, la captura debe ser **pasiva** |
| J1-13, I-1 | **BL-0107** (cruzar con OTel) + **BL-0123** (el motor nunca loguea `budget.spent()`) + **BL-0096** (primera telemetría de coste) | open / hecho | Extensión al camino manual (M-6) |
| J1-8 | **BL-0126** (el gate nunca corre un build de producción) | `open` | El nocturno es su **hogar natural** |
| J1-9 | **BL-0110** (recalibrar umbrales DR-100/073/107 con datos de la era Claude-5) · **BL-0063** (arnés mock-worker offline, coste cero) | `open` | El freno 3× es de la familia de BL-0110; BL-0063 es **el canario correcto** para tocar la escalera sin gastar un build real |
| J1-3 | **A6** de este mismo memo | propuesta | **Fusionar en un solo cambio.** El aporte es el `gate-report.json`, que convierte A6 de "ahorro de ciclos" en **contrato de datos** |
| J1-4 | **A1** | propuesta | **Se apilan, no compiten**: A1 elimina los Stops sin edición, J1-4 abarata los que sí editan |
| J1-5, E-3 | **BL-0108** (canario de re-tier de `diagnose`/`revert` a sonnet) | `open` | **Ejes distintos**: E-3 baja el tier de un veredicto advisory (ampliar BL-0108 con `visual-qa`); J1-5 recorta el bucle del bloqueante sin tocar su tier |
| J1-10, C-1/C-2/C-3 | **LESSON-0029** (`always-loaded-rules-budget-discipline`) | `candidate`, `times_applied: 0`, **80 días sin promover** | Diagnosticó este problema hace 80 días. C-5 lo convierte en gate |
| C-1 | **`docs/proposals/34`** (path-scoped rules) | `proposed`, **sin cierre en ningún decision-log**; `.claude/rules/` no existe | Ejecutar el piloto **tal como está escrito**, más la capa net-new de la raíz de la fábrica (C-2) |
| G-1, G-3, E-2b | **`docs/proposals/33`** (R-06, R-09, R-11, §7 `copywriter`) | `proposed`, ítems abiertos | Datos de coste de un run real que priorizan cuál canariar primero |
| R-57 / investigación del worker | **`docs/proposals/35`** (build-worker self-research) | `proposed` | No se duplica |
| E-5 | **BL-0124** (el pre-check DR-067 lee una escritura legítima como suciedad) | `open` | **Queda validado con datos de un run real**: 0,76 $ y 252 s |
| E-6 | **BL-0098** (doing) + **BL-0109** (peso de opus 3× vs 2,5× real) | doing / open | Cerrar antes de tocar el freno |
| E-8 | **BL-0131** (renovación del lease que deja de dispararse en silencio) | `open` | Plegarlo al bucle de `Monitor` |
| N-1 | **BL-0118** (cacheTtl investigado y **no adoptado**) | `done` sin adoptar | Reabrir **solo después de I-1**, scoped a un agente |
| S-8 | **BL-0087** (`review-launch` debe verificar producción) | `open` | 0 proyectos elegibles hoy |
| A2 | **BL-0044** (el nudge exime `plugin/agents` pero su edición sin commitear enrojece el drift gate) | `open` | Mismo fichero: arreglar juntos |
| C-3, S-7 | **BL-0095** (precedente de desduplicación) | — | Mismo patrón |
| Precondiciones de `--now` | **BL-0128** (`preflight-implement.sh` no comprueba suciedad ajena) | `open` | `--now` hereda el mismo hueco |
| Riesgo de J1-8/J1-12 | **BL-0037**, **BL-0049**, **BL-0133** (servidor dev huérfano, puerto fijo, `merge-queue.sh` sin `PORT`) | `open` | Hay que cerrarlos o el nocturno producirá rojos falsos y nadie lo mirará |
| M-A | **BL-0125** (portfolio stale) | `open` | Superficie de gobierno |
| Fricción de entrada | **BL-0050** (el aviso de backfill se re-dispara en cada llamada) | `open` | Ruido en la puerta del cambio |

**Lecciones que gobiernan este diseño (citadas, no re-descubiertas):** LESSON-0113 (*un mecanismo documentado es una propuesta, no evidencia de que esté cableado*: es el diagnóstico exacto de BL-0129) · LESSON-0078 (`$?` tras un pipe: condición de corrección de `--report-all`) · LESSON-0105/0109 (un gate que razona sobre texto dará falsos positivos: se rodean, **nunca se debilita el gate**; gobierna también el clasificador) · LESSON-0151/0184 (la herramienta de verificación se pudre sin ejecución continua: **por eso A4 va primero**) · LESSON-0029 (presupuesto del always-loaded layer) · LESSON-0002 (código malo vs test de gate defectuoso: el diagnóstico determinista **no debe pisarlo**) · LESSON-0021 (un gate compartido debe poner en cuarentena la unidad bloqueada: aplica al nocturno) · LESSON-0040 (falsos negativos de preview y servidores dev huérfanos: riesgo de J1-8/J1-12) · LESSON-0099/0155 (excluir `.pandacorp/**` de vitest; no reutilizar estado de run sucio: aplica a `gate-report.json`) · LESSON-0069/0027 (no afirmar desde un doc o una auditoría previa: por eso §0) · **LESSON-0240** (una corrección repetida se promueve a política, no a otro parche puntual: es el argumento de fondo del memo, "el owner lo hace a mano" es la segunda señal de la misma clase).

## 5.2 Lo genuinamente net-new

Niveles de rigor `micro|normal|critical` · `classify-change.sh` y su backtest de 918 commits · `gate-report.json` · `--only`/`--files` con jaula `scope:partial` · Playwright por ruta · gate nocturno por proyecto · presupuesto de contexto por rol registrado en telemetría · techo de turnos del reviewer · `close-out` como modo cálido de `sync` · freno de coste de reparación 3× · estado `closing` con caducidad de 48 h en `doc-lint` · `spec --micro` · `factory-operations.md` con `paths:` · `durationMs` por sub-gate · `pandacorp:mech` · PROMPT-9.

**Recomendación de higiene (DR-103): abrir UN BL paraguas** para el camino de cambio con estos ítems como sub-tareas, en vez de una docena de BLs sueltos, y **ampliar** BL-0129, BL-0046/0132, BL-0064 y BL-0108 en vez de duplicarlos.

---

# 6. Criterios de aceptación del encargo

| # | Criterio | Dónde está cubierto |
|---|---|---|
| 1 | Baseline medido de dónde se va el dinero y el tiempo | **Fase 0** §0.1 (tabla por categoría y por agente), §0.2 (sub-gates), §0.3 (reparaciones), §0.4 (contexto), §0.5 (manual vs fábrica) |
| 2 | Diagnóstico con evidencia `fichero:línea` para cada partida cara | **Fase 1**, sospechosos a) a h) + el hallazgo i) del hook Stop, cada uno marcado confirmado/descartado |
| 3 | Red-team de la hipótesis del owner, con contrafactuales | **Fase 2** §2.1 (10 escenarios con cifras) y §2.2 (veredicto por componente) |
| 4 | Red-team del camino manual y de la propia propuesta | **Fase 2** §2.3 (3 facturas ocultas) y §2.5 (R1-R12, distribución de 918 commits, regresiones aceptables vs nunca) |
| 5 | Diseño completo del camino de cambio, con piso innegociable | **Bloque A** §A.0-A.8 + el piso en §2.4 con su detección mecánica |
| 6 | Bloque B: el resto de la fábrica | **Bloque B** §B.1-B.8 (spec, skills, agentes, standards, hooks, motor, MC, nativas) |
| 7 | Plan priorizado con fases, dependencias, canarios y metas numéricas | **Fase 4** §4.1-4.5 + metas y canarios en §A.7 |

---

# 7. NO PUDE VERIFICAR (listas de ambos jueces, deduplicadas)

1. **El número real de eventos `Stop` por sesión.** Toda la latencia de A1 y J1-4 descansa en un supuesto de 20 turnos / 6 ediciones. No hay telemetría de hooks. **Es el número que más falta hace.**
2. **Todas las cifras de coste de L0/L1** (0,25 $ / 1,5 $) y los ahorros de J1-5, J1-9 y J1-10: **estimaciones compuestas** sobre partidas medidas de FRD-24. No verificables hasta I-1 + J1-13.
3. **Si el runtime de Dynamic Workflows expone una primitiva de shell** o `EnterWorktree`/`ExitWorktree`. Se verificó que los motores usan solo `agent()`, `parallel()`, `log()` y `budget`, pero eso prueba lo que se usa, no lo que existe. **E-2a, J1-6 y ~150 líneas del bloque C2 dependen de esto (spike E-1).**
4. **La tarifa real de `cache_creation_input_tokens`.** Los ~+9,9 $ por build usan el múltiplo habitual de 1,25× input, **no verificado**. Todo el dimensionamiento de N-1 cuelga de ahí.
5. **Si el cuerpo completo de `implementer.md` (45 líneas) se inyecta literalmente** en un dispatch MECH de una línea. Es el comportamiento esperado del mecanismo `agentType`, pero no se leyó el cargador de prompts. Afecta al dimensionamiento de G-2.
6. **Si `vitest --related <ficheros>` funciona** con la configuración instalada de MC (1 worker, `.pandacorp/**` excluido). `--changed` sí existe y se usa.
7. **Si los specs de Playwright pueden leer una lista de rutas por env var** tal como leen `e2e/_skip.ts`. El patrón existe, no se leyeron los specs.
8. **Si `madge --depends` responde dependencia inversa** con la configuración instalada. Es el sustento de la señal S17.
9. **La discrepancia de `m4`** entre suma de sub-gates (169 s) y reloj del `verify.sh` completo (107 s). Si ya hay solapamiento, el descarte del paralelismo explícito podría estar mal fundado en la dirección contraria.
10. **Por qué el `archive-changes` de FRD-24 no archivó su card.** Corrió (0,06 $) y el card sigue `ready`; no se leyó su prompt ni su transcript. **Entender esto vale más que varias de las propuestas y es prerrequisito de J1-11.**
11. **Si el coste de una sesión manual es realmente superior al de la fábrica** para trabajo equivalente. Las muestras no son equivalentes en naturaleza de tarea; el argumento de §2.3 va sobre la **curva de contexto**, que sí está medida, no sobre totales.
12. **Cuántos de los 918 commits dispararían el PISO.** Solo se calculó la distribución por **tamaño**: el 25,1 % de micro es **cota superior**.
13. **Si `/pandacorp:sync` puede absorber el `close-out`** sin desnaturalizarse. Encaja conceptualmente (modo cálido/frío, gate de intención, marca lo reconciliado-desde-código); no se leyó `sync/SKILL.md` entero.
14. **Si `check-preflight-drift.sh` (que sale con `exit 1`, no `exit 2`) bloquea realmente el Stop** o solo avisa.
15. **Dónde vive `test-whole-frd-gate-contract.mjs`** y por qué el runner no lo descubre pese a coincidir con el glob.
16. **Si `discover` corre hoy como tarea programada**: su propio SKILL dice estar diseñada para ello pero no aparece en la lista canónica de rutinas.
17. **Por qué `pandacast` se congeló en `phase: design`** el 10 de julio mientras su repo seguía recibiendo commits. **Es el único caso observable de abandono del mecanismo a mitad del pipeline, y entenderlo valdría más que varias propuestas.**
18. **El impacto real de C-1/C-2 en tokens:** las cifras son de líneas y bytes resueltos por el árbol de `@import`, con la aproximación bytes/4, no la salida de `/context` de una sesión real.
19. **Si el gate split llega a costar lo que sugiere su fan-out máximo** (13 `agent()`). En el único run con coste medido **no se activó**: todas las cifras de E-7 son potenciales.

---

# 8. La pregunta

Nada de este memo se implementa sin tu OK. **¿Qué apruebas?**

| Opción | Qué implica | Coste de arranque | Qué se consigue |
|---|---|---|---|
| **A** | El camino de cambio (Bloque A): niveles de rigor, clasificador, reparación dirigida, close-out en lote, `change --now` | Fase 0 (1 semana) + Fase 1 (2 semanas) | Que pedir un cambio pequeño cueste **~0,25 $ y 5 min** en vez de ser imposible |
| **B** | El resto de la fábrica (Bloque B): hooks, motor, standards, skills, agentes, Mission Control | Fase 0 + Fase 1 | **−15,8 % de $/build** y **−10 a −31 min por sesión manual**, más gobierno (I-1/I-2) |
| **A + B** | Los dos, en el orden de §4.2 | ~4 semanas hasta cerrar Fase 1 | El escenario agregado: **≈7,2 $ y ≈15 min** por FRD equivalente |
| **Solo Fase 0** | Los 12 quick wins de un día, empezando por A4 y J1-1 | 1 semana | La cola drenable, el gate de un día más barato, y **datos** para decidir el resto con evidencia en vez de con estimaciones |

**Recomendación:** si hay dudas, **solo Fase 0**. Contiene J1-1 (sin el cual nada del resto importa), A4 (el arnés que protege todo lo demás) y E-3 (la mayor palanca de coste de un día), y deja todas las decisiones caras para después de medir.

---

## Adenda 2026-09-21 · Reprioritización: velocidad de `implement` primero

**Directriz del owner (literal):** *"sí quiero que hagas todos los cambios, todas las propuestas, pero cuando dije que implementar es lento y hablé de los cambios, en verdad me refería a todo; lo de los cambios era solo un ejemplo. Lo que realmente es bien lento es el implement. Pandacorp implement es extremadamente lento: lo que se podría hacer directamente en 10 minutos, media hora a lo mucho, con implement se puede tomar horas, hasta medio día o un día. Eso es lo que me desanima, porque tal vez hay demasiados gates de confirmación, demasiadas revisiones, y al final el resultado es casi lo mismo. El esfuerzo principal tiene que ser en arreglar la implementación, que sea mucho más rápida."*

**Consecuencia:** el objetivo pasa de **coste** a **reloj**. Bloque A (`--now`) y bloque B se conservan íntegros pero **detrás** del sprint de velocidad. Plan ejecutable completo: `scratchpad/j3-implement-speed-sprint.md`.

### Descomposición del reloj (MEDIDO, nuevo: `wf_ddcc95c6-1d7.json → workflowProgress[]`)

| Partida | s | % | Palanca | s después |
|---|---:|---:|---|---:|
| `gate:frd-24` (99 llamadas, recoge su propia evidencia) | 1.208 | 31,1 | Evidencia pre-digerida, sin bajar tier ni saltar el gate (WP-06) | 250 |
| **`visual-qa`** | **761** | **19,6** | **Omitir: el build no tocó UI** (WP-01) | **0** |
| Reparación (`patch` 438 + `verify-patch` 151) | 589 | 15,1 | `--only`/`--files` solo en el bucle interno (WP-08) | 330 |
| Construcción real (2 WOs encadenadas por `dependsOn`) | 311 | 8,0 | Ninguna aquí — irreducible | 311 |
| `baseline-precheck`+`baseline` (BL-0124) | 252 | 6,5 | Fast-path de árbol limpio (WP-04) | 40 |
| Cierre (`archive`+`notify-end`+`release-lease`) | 244 | 6,3 | Un solo agente de cierre (WP-02) | 150 |
| **`foundation-gate`** | **179** | **4,6** | **Omitir: no fanea ninguna superficie** (WP-01) | **0** |
| Plumbing restante (commits, safe-points, dispatch, pin, worktree, sync) | 311 | 8,0 | `pandacorp:mech` + `effort:'low'` + 3 fusiones (WP-03, WP-11) | 123 |
| `plan` | 34 | 0,9 | — | 34 |
| **TOTAL** | **3.889** | 100 | | **≈1.238** |

**Tres hallazgos nuevos, verificados hoy:** (1) `foundation-gate` + `visual-qa` = **940 s (24,2 %) sobre un build que no tocó una sola ruta** — ambos disparan por `plan.hasFrontend` (project-level) y no por los `artifacts` de lo construido; el motor ya tiene ese dato. (2) **C2 SÍ se activó** (`logs[8]`) — corrige §1.d del memo: el problema no es activar la concurrencia, es que no había nada con qué solapar. (3) Las dos WOs se serializaron por **`dependsOn`** real, no por un defecto del scheduler.

**Correcciones al memo, por el spike E-1 (`e1-spike-workflow-primitives.md`):** el script de un Workflow **no tiene shell ni filesystem** ⇒ **E-2a queda descartada** (el plumbing se colapsa fusionando `agent()`, no llevándolo a código). **`agent()` no tiene `maxTurns`** ⇒ el techo de turnos del reviewer (J1-5) se implementa con evidencia pre-digerida + disciplina de prompt + `agentType`, no con un parámetro. **`effort:'minimal'` no existe** en el runtime (`low|medium|high|xhigh|max`) ⇒ E-2b/N-3 usan `'low'`.

### Meta

| Escenario | Hoy | Meta | Factor |
|---|---:|---:|---:|
| FRD-24 equivalente, camino feliz | 55,0 min | **≤15 min** | 3,6× |
| FRD-24 exacto (con su rojo) | 64,8 min | **≤21 min** | 3,1× |
| Build de 6 WOs / 2 FRDs | ~3-4 h | **≤45 min** | **≥4×** |

**Honesto:** en el run pequeño quedan ~891 s de suelo físico (construcción + juicio + reparación reales), así que el techo del sprint ahí es ~3,4×. **El 4× se cobra donde hay paralelismo que cosechar** — justo los builds de horas que desaniman al owner. Para el caso pequeño la respuesta no es optimizar el motor: es no invocarlo (`--now`, tanda F).

### Paquetes por tanda

- **Tanda A** (día 1-2, ficheros disjuntos, paralelo): **WP-00** residual del spike · **WP-01** omitir pases de UI sin UI ⭐ · **WP-05** `gate-report.json` + `--report-all` · **WP-09** instrumentación (`durationMs` por agente y sub-gate) · **WP-ZA** cierre (bump + manifests + decision-log + `build-orchestration.md §5`). **−1.170 s.**
- **Tanda B** (día 2-4, motor, regiones disjuntas): **WP-04** baseline BL-0124 · **WP-02** cierre único + `visual-qa` en background · **WP-03** dieta MECH (`pandacorp:mech` + `effort:'low'` + 3 fusiones) · **WP-11** safe-point por corrida · **WP-ZB** cierre (+ mirrors de Codex). **−430 s.**
- **Tanda C** (semana 2, canario obligatorio): **WP-06** gate con evidencia pre-digerida (opus, riesgo ALTO, toca el oráculo) · **WP-08** reparación dirigida + jaula `scope:partial` + freno 3× · **WP-ZC**. **−1.220 s.**
- **Tanda D** (semana 3): **WP-07** `pipeline()` entre WOs independientes · **WP-10** Playwright por ruta · **WP-12** presupuesto de contexto · **WP-ZD**.
- **Después:** tanda E (desbloquear: A4, J1-1, A1/A2, J1-11, gate nocturno, E-3), tanda F (el camino de cambio: clasificador, niveles en el llamador, close-out, `--now`), tanda G (resto del bloque B).

**Reglas del sprint:** todo detrás de un `args.*` con el comportamiento viejo disponible (rollback = un argumento, nunca un revert) · ningún WP se cierra sin `run-engine-tests.sh` verde · la disciplina de plugin (semver, manifests, mirrors, decision-log) va en el WP de cierre de cada tanda, no por paquete.

**NO se toca:** el tier del juez (DR-015) · el `verify.sh` completo del cierre · el re-gate whole-project de certificación · `commitChain`/lease/`block-dangerous.sh` · `foundation-gate` y `visual-qa` cuando el build **sí** toca UI · `tsc`/`knip`/`madge` acotados · que un `--only` promueva a `VERIFIED`.

### Canario

**A — el titular:** FRD sintético de 2 WOs no-UI encadenadas (la forma exacta de FRD-24) en un worktree desechable de MC, medido con `usage-rollup.mjs` extendido + `wf_*.json`. Aceptación: **≤20 min** con rojo / **≤16 min** sin rojo, `agentCount ≤ 18`, cero partidas `foundation-gate`/`visual-qa`. **Rollback: mejora < 2× tras A+B+C ⇒ parar y re-medir.**
**B — el oráculo (obligatorio para WP-06):** A/B ciego `gateEvidence: explore|digested` sobre un corpus de defectos sembrados (el rojo real de FRD-24 + 4 sintéticos: AC incumplido, authz ausente, componente casi-duplicado, violación DR-115). Aceptación: **mismo conjunto de hallazgos de clase CORRECTION**. **Rollback: un solo hallazgo perdido ⇒ vuelta a `explore`.** Parte se corre gratis con el arnés offline de BL-0063.
**C — el 4×:** build de 6 WOs / 2 FRDs con artefactos disjuntos (candidato: el card de 76 días). Aceptación: **≤45 min** y `concurrency_max ≥ 3`.

**Pre-flight de coste cero:** `bash plugin/scripts/run-engine-tests.sh`. Un WP cuyo criterio de aceptación no se pueda expresar como escenario del arnés está mal especificado.

**NO PUDE VERIFICAR:** que el gate baje a ≤300 s (estimación que sostiene media tabla) · toda la columna "s después" salvo las omisiones de WP-01 · el enum real de `effort` en ejecución · si los subagentes reciben los 23.162 tok de prefijo · por qué dos WOs `difficulty: low` tardaron 311 s · `vitest --related` y rutas por env var en Playwright con la config instalada · si `pipeline()` respeta `commitChain` · **si `/pandacorp:upgrade` propaga el motor al proyecto canario** (si no, el canario mide el motor viejo — el fallo silencioso más probable del plan). Lista completa en `j3-implement-speed-sprint.md §NO PUDE VERIFICAR`.

---

## Estado de ejecución 2026-09-22 (plugin 9.103.0)

**Implementado.** Tanda A completa: WP-01 (omitir `foundation-gate`/`visual-qa` cuando el build no toca UI), WP-02 (cierre único, lean close-out), WP-03 (dieta `pandacorp:mech` + `effort:'low'` + fusiones de plumbing), WP-04 (baseline fast-path, BL-0124), WP-05 (`gate-report.json`), WP-06 (gate con evidencia pre-digerida, `gateEvidence`), WP-08 (reparación dirigida + jaula `scope:partial` + freno de reintentos, `repairBrake`), WP-09 (instrumentación por agente/sub-gate), WP-11 (safe-point por corrida). Además E2 (drenaje del cambio-cola en plan vacío, BL-0129), E3 (fast-path del hook de stop) y F1 (clasificador `classify-change.sh`, el motor de rigor micro/normal/critical). Dos revisiones independientes en Opus (24 tests adversariales sobre el clasificador y el motor de build, 21 fixes entre ambas rondas) cerraron los huecos que encontraron, salvo uno (abajo).

**Defaults vigentes tras el sprint** (todos detrás de `args.*`, comportamiento viejo disponible por rollback): `forceUiPasses: false`, `leanCloseOut: true`, `strictBaseline: false`, `safePointEveryWave: false`, `mechLean: true`, `drainOnEmptyPlan: true`, `repairBrake: true`, `scopedRepair: false` (deliberadamente apagado, ver BL-0138: el freno usa peso-por-agente, no tokens reales, y castiga FRDs de 1 WO), `gateEvidence: 'explore'` (el modo `digested` existe pero no es el default hasta que el canario B lo certifique).

**NO hecho todavía (a cierre de 9.103.0):**
- **Canarios A/B/C** (el titular ≤20 min, el oráculo ciego explore-vs-digested, el 4× de 6 WOs) siguen pendientes de ejecución en vivo (BL-0135).
- **Camino `--now`** (tanda F: clasificador ya en main pero sin nivel de rigor cableado en el llamador, sin close-out ligero de cambios, sin ruta directa sin `/implement`): fases F2-F5 del plan, no arrancadas.
- **Bloque B** (tandas D/E/F/G originales del memo: `pipeline()` entre WOs, Playwright por ruta, presupuesto de contexto, y el resto de desbloqueos) sigue completo, sin tocar.
- **REV2-C**: el clasificador no detecta un guard de propiedad (`ctx.u.id !== row.o`) escrito sin vocabulario de auth: hueco conocido y documentado como XFAIL en `test-classify-change.sh`, no como verde falso. Seguimiento: **BL-0140**.

## Estado de ejecución 2026-09-22, segundo lote (plugin 9.104.0, overlay 8.82.0)

**Implementado.** F2 (Stop gate escalado a full en diffs de UI o ancla >24h), F3 (`/pandacorp:sync --close-out`), F4 (`/pandacorp:change --now`, revertido a opt-in el mismo día tras el defecto D2 de la revisión batch 3), F5 (rollup de uso por cambio). Quick wins E-3/G-4/S-3/C-3 (G-3 evaluado y NO aplicado: duplica BL-0115, ya cerrado). fix1/BL-0141 (degradación honesta ante un `agentType` desconocido, más el endurecimiento de la revisión batch 3 para que un tipo ORACLE nunca se degrade en su propio constructor). Aislamiento de telemetría en `test-codex-enforcement.mjs`. El merge de `mc-change-queue-statuses` (Mission Control acepta `building`/`closing`), que cierra exactamente el hueco que `now-mode.md` documentaba como abierto. Tercera revisión independiente (batch 3): defectos D1/D2/D4/D5/D7/D9/D10 encontrados y corregidos (no hubo D3/D6/D8; ver el decision-log del plugin para el detalle completo). `run-engine-tests.sh`: 22/22 tras corregir una regresión de formato en `test-change-now-prose.sh` causada por el propio merge (dos aserciones `grep` de una sola línea contra un array que el merge reformateó a multilínea; arreglo de arnés, sin cambio de comportamiento).

**Defaults que cambian respecto al primer lote:** `PANDACORP_STOP_GATE` gana la escalada automática a `full` (UI/ancla stale) descrita en F2; `/pandacorp:change` sigue con `--queue` (captura) como default: `--now` queda como opt-in explícito hasta que el canario de `now-mode.md` corra en verde con D2 corregido.

**NO hecho todavía (a cierre de 9.104.0):**
- **Canario A** corrió (ver abajo) y **FALLÓ** el umbral de tiempo. Sigue sin certificar el titular del sprint.
- **Canario B** (oráculo `explore` vs `digested`) está corriendo en este momento en un worktree separado (`panda-corp-canary-b`); su resultado queda para un commit posterior.
- **Canario C** (el 4× de 6 WOs) no ha arrancado.
- **Bloque B** (tandas D/E/F/G originales del memo) sigue sin tocar.
- **`gateEvidence: 'digested'`** y **`scopedRepair`** siguen sin medirse en vivo. El Canario A confirma que son las dos palancas con más margen (ver abajo), pero ninguna fue ejercida en el run.

## Canario A · 2026-09-22 (medido)

Ejecutado en vivo (`wf_4cef213a-463`, FRD sintética de 2 WOs no-UI, `mode: powerful`, `mechLean: false` forzado por desfase de plugin de la sesión (9.102.3, sin `pandacorp:mech`)). Informe completo en el scratchpad de esta sesión (`canary-a-report.md`).

| Partida | FRD-24 (baseline) | Canario A | Δ |
|---|---:|---:|---:|
| Total | 3889 s / $20.86 | 2613.9 s / $13.419 | −32.8% s / −35.7% $ |
| `foundation-gate`+`visual-qa` | 940 s / $7.10 | 0 / $0 (correctamente omitidos) | −100% |
| `gate` | 1208 s / $6.51 | 910.5 s / $5.961 | −24.6% / −8.4% |
| `verify-patch` | 151 s / $0.99 | 231.4 s / $1.638 | **+53.2% / +65.5%** (peor) |

**Ranking por segundos:** gate (34.8%) · patch (16.2%) · cierre/`notify-end` (14.3%, re-corre `verify.sh` completo antes de comitear) · verify-patch (8.9%) · build×2 (9.4% combinado) · el resto es plumbing/safe-point/plan.

**Veredicto contra los umbrales de BL-0135:** ❌ **FALLA** el tiempo (≤1.200 s con reopen; medido 2613.9 s, +117.8%). ✅ PASA `agentCount ≤18` (justo 18). ✅ PASA la omisión de `foundation-gate`/`visual-qa`. 2 de 4 criterios, pero el dominante (tiempo) falla por más del doble.

**Palancas restantes:** `gateEvidence: 'digested'` no fue medido (el `gate` con `explore` ya consume el 76% del umbral "sin rojo" él solo; es la palanca más prometedora, sin dato real de ahorro). `scopedRepair` confirmado apagado (BL-0138): `verify-patch` corrió `tsc`/`biome` sin acotar sobre todo el proyecto. `mechLean` fue forzado a `false` por desfase de sesión, no por diseño; su ahorro estimado por proporción (≈35 s) no acerca el run al umbral por sí solo. El cierre de BL-0147 (re-correr `verify.sh` completo en el close-out) es candidato a solapar con `verify-patch`, no confirmado como duplicado.

**Siguiente paso:** Canario B corrió y su informe llegó después de este release (ver la sección dedicada abajo). BL-0135 permanece `open`.

## Canario B · 2026-09-22 (medido, commit de seguimiento)

Ejecutado en vivo (`wf_dd3b6dfc-257`, `gateEvidence: 'digested'`, mismo FRD sintético reseteado al estado pre-gate de A). Informe completo en el scratchpad de esta sesión (`canary-b-report.md`).

**Hallazgos (el criterio de aceptación de B): CUMPLE, empate exacto.** `digested` encontró el mismo único hallazgo CORRECTION que `explore` (mismo fichero/línea/causa raíz), con inventario de traceability igual de completo. No se perdió ningún hallazgo; el disparador de rollback de este canario no se activó.

**Ahorro medido: real pero muy por debajo del objetivo.** `gate`+`evidence` (845.995 s / $4.446624) vs `gate` solo de A (910.5 s / $5.960614): **−7,1% tiempo, −25,4% coste**. El objetivo declarado era ≥60% de tiempo; no se alcanza.

**Por qué el número de tiempo probablemente subestima el techo real de la palanca:** el paquete de evidencia pre-digerida llegó con sus 4 sub-gates baratos rotos por un defecto de infraestructura (el worktree congelado del colector no tenía `node_modules`), no por un hallazgo real. El gate lo detectó correctamente (el re-run obligatorio de D1 sí se disparó, confirmado con `vitest.exit: 1` real) pero tuvo que pagar el bootstrap + re-verificación completa de todos modos, exactamente el trabajo caro que `digested` existe para evitar.

**Veredicto:** no se declara cumplido el umbral del 60% con esta única medición (n=1). Seguridad de hallazgos probada y ahorro de coste real ya se cobra hoy; recomendable activar `digested` para builds de bajo riesgo sin UI, pero arreglar primero el defecto de `node_modules` del colector y re-medir antes de cambiar el default global. `LEASE_RENEW_FAILED` tampoco aparece en los artefactos de este run, igual que en A. Detalle completo (anomalías de concurrencia, discrepancias de reloj) en el decision-log del plugin.

**Prerrequisito antes de correr el canario:** Mission Control (y cualquier otro proyecto candidato) debe pasar por `/pandacorp:upgrade` para recibir el motor nuevo (el memo ya señalaba esto como el fallo silencioso más probable, "si no, el canario mide el motor viejo"); sigue sin verificarse en vivo.

## Canario B2 · 2026-09-23 (medido, worktree de gate bootstrapeado + `mechLean`)

Ejecutado en vivo (`wf_78ba5660-bd9`, mismo FRD-25 sintético reseteado al estado pre-gate de A/B, `gateEvidence: 'digested'`, `mechLean` inferido `true` — no aparece como clave explícita en `args`, pero 5 de 11 agentes tienen `agentType: pandacorp:mech`, frente a `pandacorp:implementer` en esos mismos pasos cuando A corrió con `mechLean:false` explícito). Informe completo en el scratchpad de esta sesión (`canary-b2-report.md`).

**Objetivo:** re-medir `digested` sobre la topología REAL de Mission Control (anidada dentro de `panda-corp/`, a diferencia de los fixtures planos de A/B) para descartar la contaminación por `node_modules` que el informe de B ya había marcado. **Resultado: sigue contaminado, por una causa relacionada pero DISTINTA, ya diagnosticada y arreglada en el propio sprint.** `worktree-bootstrap.sh` paso 1 solo instalaba dependencias si `package.json` estaba en la RAÍZ del worktree; Mission Control vive anidada (`panda-corp/mission-control/`), así que el `pnpm install` nunca corrió para el paquete real. El colector de evidencia lo detectó correctamente y rehusó fabricar un reporte (`GateEvidenceFallback`, `reason: gate-worktree-not-bootstrapped`, confirmado en `~/.claude/dashboard-events.ndjson`), pero el `gate` tuvo que bootstrapear a mano dentro de `gate-worktree/mission-control` — el mismo trabajo caro que `digested` existe para evitar. **Causa raíz confirmada por lectura directa del script y arreglada: BL-0155 (plugin 9.104.4), posterior a este run.**

**Ahorro medido (`gate`+`evidence` de B2 vs `gate` solo de A, la comparación que pide BL-0135):** 910,5 s → 728,043 s = **−20,04 % tiempo**; $5,960614 → $5,380662 *(4 partidas opus estimadas, ver nota de pricing)* = **−9,73 % coste**. **No cumple el criterio de span (≥40 %)**, aunque sí el de hallazgos: B2 encontró el mismo finding CORRECTION que A/B (`AC-25-001.3`, letras con trazo) **más uno nuevo** (`AC-25-002.1`/`.3`, el delimitador POSIX `--` de la CLI del slug normalizer, `scripts/text/slug-normalizer-cli.mjs:37,43`) — superset sin pérdida, reopen de 2 WOs en vez de 1.

**`mechLean` — primer dato medido en vivo, no extrapolación.** Sobre los 4 pasos de plumbing comparables 1:1 con A (`pin`, `baseline-precheck`, `gate-worktree`, `notify-end`): 474,1 s → 319,93 s = **−32,5 % tiempo**; $0,620081 → $0,471083 = **−24,0 % coste** — más del doble de la extrapolación de A (×0,895 ≈ 10,5 %, "no medida en ningún canario real"). **Recomendación: mantener `mechLean: true` por defecto** — es la única palanca de esta tanda con ahorro medido, positivo y mayor al estimado.

**BL-0147 (el cierre repite `verify.sh` completo minutos después de que `verify-patch` ya lo corrió verde sobre el mismo sha) se repite tal cual en B2**, confirmado por el timestamp de `gate-report.json` (dentro de la ventana de `notify-end`, no de `verify-patch`) y por la ausencia de las cadenas `reused-verify-patch-report`/`full-rerun` en el transcript de `notify-end` — sigue `status: open`.

**Veredicto:** `gateEvidence: 'digested'` **sigue sin activarse por defecto**. El bootstrap anidado (BL-0155) era la causa real del déficit de span y ya está arreglado, pero B2 corrió CON el bug presente — hace falta un tercer run limpio, post-9.104.4, para certificar el ≥40 %. `mechLean: true` queda **confirmado como default** con dato real. Ningún run de esta tanda (A/B/B2) alcanza el 4×: los tres tienen `concurrency_max: 1` (1 FRD, 100 % secuencial) — el 4× solo puede probarse con paralelismo real de WOs, el eje que Canario C debía ejercitar.

## Canario C · 2026-09-22/23 (medido, powerful `maxAgents: 40`, sobre un `/change` real)

Ejecutado en vivo (`wf_1cf782d6-2ed`, `mode: powerful`, `maxAgents: 40`, `gateEvidence: 'digested'`, plugin 9.104.3 — anterior al fix BL-0155) sobre el card real `portada-seal-coverage-commits-funnel-ideas.md` de la cola de Mission Control, relanzado en sesión limpia tras el aborto por límite de uso registrado en BL-0135. Informe completo (`canary-c-report.md`) + forense del bloqueo (`canary-c-forensics.md`) en el scratchpad de esta sesión.

**59,52 min / $38,60 reales (+ $13,27 de cache-write estimado, excluido del total), 17 agentes, `concurrency_max: 4`.** **Comparación NO limpia con FRD-24/A/B/B2:** el run construyó **0 WOs nuevas** — WO-23-007 ya estaba `IN_REVIEW` de un intento previo, así que el `change` resultante fue **1 FRD / 1 WO**, no las "6 WOs / 2 FRDs" que se esperaban al planear el canario. El `concurrency_max: 4` observado viene de un fan-out de **4 "finders" adversariales** (correctness/security/quality/runtime, 3,5 de 59,5 min totales), no de WOs paralelas — **este run no mide el eje de paralelismo de build que el objetivo 4× necesita**.

**`GateEvidenceFallback` disparado, como se esperaba** (mismo bug de bootstrap anidado que B2, BL-0155, no arreglado a tiempo para este run en 9.104.3): el gate #1 corrió en modo EXPLORE — **1210,8 s / $17,636972, el 45,7 % del coste total del run y el gate más caro medido en las 4 corridas (A/B/B2/C)**.

**El FRD terminó BLOQUEADO (`error`) pese a que AMBOS gates de WO-23-007 dieron veredictos correctos** (intento 1: reopen legítimo con 3 findings reales; intento 2, tras el repair: `green:true`, `verify.sh` completo en verde, 25 contratos de trazabilidad). **Causa raíz confirmada por la forense (`canary-c-forensics.md` §1/§5): un bug del MOTOR, no del código.** `enforceWholeFrdTraceability` (`plugin/templates/shared/.claude/engines/pandacorp-build.js:744-750`) exige ≥1 entrada de cada una de las 7 `contractClass`; ambos gates de FRD-23 omitieron la clase `requirement` (cubrieron cada REQ vía sus AC, un inventario sustancialmente completo, no vacío). El oráculo **reescribe el veredicto entero**, borrando `reopen`/`findings`/`blocked_reason` — así el motor se saltó el patch dirigido (DR-073) y cayó en `attemptRepair` sin findings, y tras el segundo gate (también sin `requirement`) bloqueó con el reason por defecto `'error'` en vez de `'needs-owner'`. Fix mínimo (tres puntos, B1+B2+B3) y tests de regresión (R1/R2/R3) ya diseñados en la forense con línea exacta; seguimiento **BL-0157 (en curso, abierto por otro agente en paralelo — no tocado en esta sesión)**.

**`pandacorp:mech`: 5 spawns (`baseline-precheck`, `pin`, `gate-worktree`, `evidence`, `notify-end`), $0,775213 / 549,8 s, 0 `MechFallback`.**

**Distancia al objetivo 4× (16 min / ~5 $):** proyectando (estimación, no medición) con el `gate`+`evidence` limpio de B2 en lugar del gate#1 contaminado — la mejor aproximación disponible, ya que ninguna corrida de esta tanda mide un `digested` genuinamente limpio —, el run cae a ≈46,7 min / ≈$25,96: **≈2,92× el objetivo en tiempo, ≈5,19× en coste**. Sin la sustitución (bruto real): ≈3,72× / ≈7,72×. **El run tampoco es apto para proyectar el eje de paralelismo de build** (0 WOs construidas — cualquier cifra de esa palanca sería inventada).

**Hallazgos hermanos de la forense (§7, sin diagnosticar causa, solo constatados con evidencia):** un falso positivo de `block-dangerous.sh` al crear un fichero NUEVO en `.pandacorp/inbox/changes/`; un gate verde sin `apply-gate` que no deja rastro en `track.jsonl`/`dashboard-events.ndjson` y un `progress.md` que narra al owner una decisión pendiente ya resuelta; un `baseline-precheck` que escala a opus por `status.yaml` ensuciado por la propia lease (misma clase que BL-0124, ya cerrado); el bootstrap del gate-worktree apuntando `PANDACORP_FACTORY_ROOT` a la fábrica MAIN en vez de al worktree del canario; y un hueco de renovación de lease de 56,6 minutos (`acquired_at` 19:49:34 → siguiente `renewed_at` 20:46:10) — la misma clase que BL-0153 ya rastrea, aquí con la evidencia más severa medida hasta ahora (el triple de los ~13 min de A/B). Cada uno se registra como su propio BL (ver tabla de cierre).

**Veredicto:** el objetivo 4× **no se alcanza ni se mide limpiamente** en ninguno de los 4 canarios corridos (A/B/B2/C). La única cifra sólida del sprint sigue siendo Canario A: −32,8 % tiempo / −35,7 % coste (≈1,49×), por debajo del disparador de rollback (2×). Medir el paralelismo real de build requiere un `change` con **≥3 WOs independientes** sobre el motor **9.104.5** (con B1/B2/B3 de BL-0157 ya arreglados) — decisión pendiente del owner, coste estimado ~40 $ (ver BL-0135).

## Cierre del sprint 2026-09-22/23

> **Corrección de medición (BL-0181, 2026-09-25):** `usage-rollup.mjs` sumaba el `usage` de CADA línea
> del transcript JSONL, pero Claude Code escribe una respuesta facturada como VARIAS líneas (una por
> bloque de contenido) que repiten el mismo `message.id` — así que cada llamada se contaba ~1,6-1,8×.
> Fix (dedupe por `message.id`, última línea gana) + evidencia completa: `docs/proposals/38 §Red-team
> addendum §A1`. Todos los **$** de esta sección y de la tabla comparativa de abajo fueron medidos con
> el rollup ANTES del fix — quedan marcados **"(medido con rollup 1,6×)"**; el valor corregido va al
> lado como **"$ real (BL-0181)"**. Las comparaciones RELATIVAS (deltas %, factores ×) se mantienen
> dentro de ±7 % — ningún veredicto de este cierre cambia de signo por la corrección.

**Veredicto final del sprint (2026-09-25, tras canario D — actualiza el veredicto de la tanda 2 de abajo, que solo cubría A/B/B2/C):** el objetivo 4× **no se alcanza con paralelismo de build**, porque el cuello real no es el build en paralelo — es la **revisión por FRD en serie**. Canario D2 midió el único run de esta tanda con paralelismo genuino de WOs (3 construidas a la vez) y aun así terminó **peor que el baseline en coste** (2,07× *medido con rollup 1,6×*; **2,04× real, BL-0181**) y prácticamente empatado en tiempo (6% peor): el 66% del wall-clock y el 85% del coste de D2 son gates de FRD corriendo uno detrás de otro. **La única mejora sólida de todo el sprint sigue siendo el Canario A** (−32,8% tiempo / −35,7% coste, ≈1,49× *medido con rollup 1,6×*; **−38,9% coste, ≈1,64× real (BL-0181)** — la corrección MEJORA la cifra de A, no la empeora) — todo lo demás (B/B2/C/D) o no midió limpio o midió un techo estructural, nunca el objetivo. Lo que el sprint SÍ logró, en cambio, es real: los canarios destaparon y cerraron **más de 20 bugs del motor** (BL-0149, BL-0150, BL-0155, BL-0156, BL-0157, BL-0158, BL-0159, BL-0160, BL-0153, BL-0154, BL-0161, BL-0162, BL-0164, BL-0165, BL-0166, BL-0167, BL-0168, BL-0169, BL-0171, BL-0172, BL-0173, BL-0174, BL-0175, BL-0176, BL-0177 — 25 ids, la mayoría cerrados en `main`). La palanca que queda para acercarse al 4× es **estructural, no incremental, y requiere una decisión del owner**: (a) **gates de FRD en paralelo** (el motor los serializa a propósito hoy, DR-050/BL-0021 — la proyección marcada, no medida, de D2 es **−31 min** si los 3 gates de frd-03/04/05 corrieran a la vez) y/o (b) **`gateEvidence: 'digested'` re-medido limpio** (ningún run de todo el sprint, incluyendo D, lo ejercitó sin contaminación — sigue sin certificar) más **F3** (la política del oráculo de deriva pre-existente, BL-0178, abierta). **Fixes de tandas anteriores ejercitados EN VIVO por el canario D:** BL-0159 (telemetría de gate sin `apply-gate`) sí — confirmado en D2's frd-02; BL-0154 (puerto e2e fijo a 3900) sí — los 4 gates/builds de D2 usaron puertos distintos, ninguno 3900. **BL-0147 (reuse de verify.sh en el cierre) NO se ejercitó** — ambos `notify-end` de D1 y D2 corrieron el `verify.sh` completo sin reusar nada; causa raíz y decisión pendiente en **BL-0179**, filed nuevo en este cierre.

**En `main`:** plugin 9.103.0 → 9.104.4 (overlay 8.82.2). Segundo y tercer lote (F2-F5, quick wins, fix1/BL-0141, BL-0146, `mc-change-queue-statuses`, BL-0149/BL-0150 destapados por Canario B) más los dos bugs de instrumentación/bootstrap que las mediciones de Canario B2 y C destaparon: **BL-0155** (bootstrap del worktree de gate no resolvía el `package.json` anidado de Mission Control — causa raíz confirmada del déficit de span de B2 y C) y **BL-0156** (`usage-rollup.mjs` sin precio para `claude-opus-5-5` + `--dir --out` silenciosamente no-op).

**Veredicto honesto del objetivo 4×: NO alcanzado ni medido limpiamente.** Canario A sigue siendo la única cifra sólida (−32,8 % tiempo / −35,7 % coste, ≈1,49×, por debajo del disparador de rollback 2×; **−38,9 % coste, ≈1,64× real, BL-0181** — sigue por debajo del disparador). B2 confirma el mismo techo estructural (≈1,6× estimado combinando partidas reales) y C, el único intento de medir paralelismo real, midió 0 WOs construidas y terminó bloqueado por un bug del motor ajeno a `digested`/`mechLean`. Distancia proyectada al objetivo (16 min / 5 $): **≈2,9× tiempo / ≈5,2× coste** desde C. Medir el paralelismo real exige un `change` con ≥3 WOs independientes sobre el motor 9.104.5 — decisión del owner, ~40 $ estimados.

**Decisión de defaults:** `gateEvidence` se queda en `explore` — ningún run de la tanda mide un `digested` limpio (B, B2 y C corrieron los tres con el bug de bootstrap presente o recién arreglado sin re-medir). `mechLean: true` queda **confirmado** como default con dato real (B2, −32,5 % tiempo / −24,0 % coste en plumbing, más del doble de lo estimado). `scopedRepair` sigue `false` (BL-0138, freno por peso de agente no por tokens reales, sin medir en ningún canario de esta tanda). `/pandacorp:change --now` sigue en opt-in (revertido tras el defecto D2 de la revisión batch 3 sobre el Stop gate).

**Bugs descubiertos por los canarios (los cuatro corridos: A, B, B2, C):**

| id | qué encontró | canario | estado |
|---|---|---|---|
| BL-0149/BL-0150 | Worktree de gate sin bootstrapear (fix parcial) + dedupe de spawn | B | cerrado (9.104.2) |
| BL-0155 | `worktree-bootstrap.sh` paso 1 no resuelve el `package.json` anidado de Mission Control (BL-0149 no cubría el caso real) | B2, C | cerrado (9.104.4) |
| BL-0156 | `usage-rollup.mjs` sin precio para `claude-opus-5-5` + `--dir --out` no escribe nada | B2 | cerrado (9.104.4) |
| BL-0157 | El oráculo de trazabilidad whole-FRD reescribe/pierde un veredicto de gate (reopen/findings/green) cuando falta la clase `requirement`, bloqueando con `'error'` un FRD cuyo código y `verify.sh` están verdes | C | abierto (otro agente, en curso) |
| BL-0158 | `block-dangerous.sh` falso positivo al crear un fichero nuevo en `inbox/changes/` — impidió registrar el bug real de FRD-10 | C | abierto |
| BL-0159 | Gate verde sin `apply-gate` no deja rastro (`review_end`/`GateVerdict`/`frd_end`) y `progress.md` narra una decisión pendiente ya resuelta | C | abierto (parcialmente cubierto por BL-0157) |
| BL-0160 | `baseline-precheck` escala a opus por `status.yaml` sucio por la propia lease (recurrencia de la clase BL-0124) + bootstrap del gate-worktree apunta `PANDACORP_FACTORY_ROOT` a la fábrica MAIN | C | abierto |
| BL-0153 | Renovación de lease depende del tope de Monitor (~30 min) — nueva evidencia: 56,6 min sin renovar en C | A, B, C | abierto |

**Tabla comparativa de los 4 canarios + baseline:**

`$` es el coste medido con el rollup PRE-BL-0181 (sumaba cada línea streameada del transcript en vez
de deduplicar por `message.id`, ~1,6-1,8× de sobreconteo — ver la nota de corrección al inicio de esta
sección y `docs/proposals/38 §Red-team addendum §A1`). `$ real (BL-0181)` es el mismo run recalculado
con el rollup arreglado, evidencia en `mission-control/.pandacorp/track.jsonl` (`"corrected":
"BL-0181"`). Canario B no tiene columna corregida: el `$` original ya era `n/d` (solo se midió
gate+evidence, no el build completo), y ese alcance no es reproducible con el fix por sí solo.

| Run | min | $ *(medido con rollup 1,6×)* | $ real (BL-0181) | factor | agentes | `concurrency_max` | WOs construidas | gate (min / $) | findings CORRECTION |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| FRD-24 (baseline) | 64,8 | 20,86 | **13,05** | 1,60× | 22 | 1 | 2 | 20,1 / 6,51 | 1 |
| Canario A (`explore`) | 43,6 | 13,42 | **7,97** | 1,68× | 18 | 1 | 2 (reopen) | 15,2 / 5,96 | 1 (empate con baseline) |
| Canario B (`digested`) | n/d *(solo gate+evidence medido)* | n/d | n/d | n/d | n/d | n/d | 1 WO reabierta | 14,1 / 4,45 | 1 (empate exacto con A) |
| Canario B2 (`digested` + `mechLean`) | 25,4 | 8,76 *(4 partidas est.)* | **5,66** | 1,55× | 11 | 1 | 0 nuevas (2 reabiertas) | 12,1 / 5,38 *(est.)* | 2 (superset, +1 nuevo) |
| Canario C (powerful, `/change` real) | 59,5 | 38,60 | **23,42** | 1,65× | 17 | 4 *(solo en finders, no WOs)* | 0 nuevas (1 ya `IN_REVIEW`) | 20,2 / 17,64 *(gate#1, explore por fallback)* | 1 real (bug FRD-10) + bloqueo por bug del motor (BL-0157) |
| Canario D1 (powerful, `maxAgents:8`, paralelismo) | 15,8 | 6,28 | **3,64** | 1,72× | 10 | 1 *(colapsó a 1 WO por presupuesto de agentes, BL-0173)* | 1 (WO-02-014, quedó `IN_REVIEW`) | n/d *(no llegó a gatear)* | n/d |
| Canario D2 (powerful, `maxAgents:40`, paralelismo real) | 87,5 | 58,58 | **36,24** | 1,62× | 27 | 4 *(3 WOs a la vez ~4 min de 87,5; el resto es gate serial)* | 3 nuevas + 1 ya `IN_REVIEW` (bloqueada) | 20,2 / 11,67 *(gate#1 frd-02, explore, el más caro de los 4 gates)* | 1 real (bloqueo legítimo frd-02, ver BL-0178) |

**Pendiente para acercarse al objetivo real:** un canario de paralelismo con ≥3 WOs independientes, corrido sobre el motor 9.104.5 (una vez BL-0157 aterrice) — decisión del owner, ~40 $ estimados (ver BL-0135).

| id | qué | prioridad | coste est. | quién lo lanza |
|---|---|---|---|---|
| BL-0157 | Oráculo de trazabilidad pisa el veredicto del gate (bloqueo `error` sobre código verde) | p1 | en curso (otro agente) | agente |
| BL-0158 | block-dangerous.sh falso positivo bloquea fichero nuevo en inbox/changes/ | p1 | ~3-5 $ | agente |
| BL-0159 | Gate verde sin apply-gate: sin rastro de telemetría + progress.md narra falso | p1 | ~5-8 $ | agente |
| BL-0160 | baseline-precheck escala por status.yaml sucio por la lease + PANDACORP_FACTORY_ROOT mal resuelto en gate-worktree | p2 | ~5-8 $ | agente |
| BL-0153 | Renovación de lease depende del tope de Monitor (~30 min) — 56,6 min sin renovar en C | p2 | ~5-8 $ | agente |
| BL-0135 | Canario de paralelismo (≥3 WOs) sobre motor 9.104.5 | p1 | ~40 $ | pendiente OK del owner |
| BL-0140 | classify-change no detecta guard de ownership sin vocabulario de auth | p1 | ~5-10 $ | agente |
| BL-0151 | Proteger worktree de deploy (lock mecánico + gate) | p1 | ~3-5 $ | agente |
| BL-0134 | classify-change marca todo factory/** como critical | p2 | ~5-8 $ | agente |
| BL-0138 | scopedRepair: presupuesto por tokens reales, no peso | p2 | ~5-8 $ | agente |
| BL-0147 | close-out repite verify.sh completo tras verify-patch (confirmado que se repite en B2) | p2 | ~3-5 $ | agente |
| BL-0152 | Preflight de desfase sesión/motor en launch-implement.sh | p2 | ~3-5 $ | agente |
| BL-0154 | Puerto 3900 fijo en e2e colisiona entre worktrees | p2 | ~3-5 $ | agente |
| BL-0044 | warn-adhoc-write exime plugin/agents del nudge de aislamiento | p2 (doing) | ~2-3 $ | agente |
| Manual MC | Drenar cards gitignored `manual-speed-sprint-args.md` y `render-uipassskipped-timeline.md` de la cola de MC | p2 | mínimo | owner/agente |
| BL-0148 | MC rechazaba building/closing | — cerrado hoy (commit `98b9b91f`) | — | — |
| G-3 | Escalada test-writer por dificultad de la WO | descartado (duplica BL-0115, ya cerrado) | 0 $ | n/a |

### Tanda 3 (2026-09-22, 9.106.0)

Integración en serie de tres ramas ya construidas y cerradas en su propio worktree: **BL-0147**
(close-out reutiliza un `gate-report.json` full+verde del mismo sha en vez de repetir `verify.sh`
completo — el fichero ahora estampa `sha`), **BL-0138** (freno de reparación con segundo criterio
de tokens reales sobre el ya-existente piso de 9 unidades por peso de agente — `scopedRepair`
**sigue en `false`**: al releer el mecanismo de reparación con alcance apareció un riesgo distinto
al que este fix arregla, sin datos en vivo todavía que justifiquen el flip) y **BL-0161/BL-0162**
(los dos bugs de contrato reales que destapó el **primer dry-run real de `/pandacorp:change --now`**
sobre Mission Control — informe `change-now-dryrun-report.md`, sesión `e4c52a6e-6796-4768-a5fe-49177084ebe4`,
no está en el repo, solo en el scratchpad de esa sesión).

El dry-run confirma que `--now` **funciona de punta a punta** — subagente implementer en worktree
aislado, gate del nivel, reviewer opus independiente que bloqueó de verdad 2 hallazgos reales (no
sello de goma), ciclo de reparación real, cierre con `sync --close-out` hasta `main` — pero le costó
**~22 min y ≈$33 medidos** (≈$38 con la creación de caché no facturada) a un cambio de 2 páginas de
docs que debería haber sido casi trivial. Encontró además **BL-0161** (el clasificador nunca podía
certificar `micro` en Mission Control por resolver `node_modules` desde la raíz git de la fábrica,
no del proyecto anidado) y **BL-0162**, el hallazgo más grave del canario: el paso D de
reclasificación lee `--card` desde dentro del worktree aislado del implementer, pero
`.pandacorp/inbox/` está gitignored y nunca se materializa ahí — seguido al pie de la letra, degrada
CUALQUIER cambio seguro a `critical` por una razón espuria (falla en la dirección insegura, al
revés que BL-0161). Ambos ya están cerrados en `main` (commits `e450ce81`/`2e99ba79`). **BL-0163**
queda abierto — sin entry point documentado para apuntar `--now` a una card `ready` ya existente —
como decisión pendiente del owner, no implementación.

**Veredicto sobre `--now`: sigue en opt-in, no pasa a default.** El propio criterio del dry-run
(§5 del informe) es que hace falta repetir este mismo canario, de punta a punta, con las dos
correcciones en vigor, antes de considerar el flip — ese re-run todavía no ha ocurrido.

### Canario D (paralelismo, 2026-09-25)

Ejecutado en vivo sobre `mission-control`, motor 9.108.0, `mode: powerful`, dos corridas sobre la
misma change (`canary-d-parallelism`, 4 FRDs candidatas). Informes completos en el scratchpad de la
sesión de medición: `canary-d-report.md` (medición D1+D2), `canary-d-frd02-forensics.md` (forense del
bloqueo de frd-02) y `canary-d-wave-investigation.md` (por qué D1 colapsó a 1 WO).

**D1** (`wf_6e88dd68-8e4`, `maxAgents:8`): **15,8 min / 6,28 $**, 10 agentes, `concurrency_max:1`.
Construyó solo **WO-02-014** (1 de 4 FRDs candidatas) — **cortado por `maxAgents 8`, que es un
presupuesto TOTAL de agentes de la corrida (cost-weighted), no un ancho de oleada**: el overhead fijo
pre-oleada (`baseline-precheck`+`process-change`+`plan`+`safe-point`+`foundation-gate`, forzado por
`FORCE_UI_PASSES` default) ya sumaba 11 unidades antes de que existiera la primera oleada, agotando el
presupuesto de 8 y colapsando `pickDisjointWave` a exactamente 1 WO por su piso anti-deadlock
(`Math.max(1, …)`). Confirmado por lectura directa del motor, no es un bug de conteo — es el overshoot
que el propio `SKILL.md` documenta como esperable (`~11 units` de overshoot). El hallazgo real,
cerrado como **BL-0173**, es que ese colapso era indistinguible en el log de un recorte por
dependencias/artefactos reales — ahora `pickDisjointWave` reporta `cutBy: 'count-cap' | 'agent-budget'`.

**D2** (`wf_faf48b18-881`, `maxAgents:40`): **87,5 min / 58,58 $**, 27 agentes, `concurrency_max:4`.
**El paralelismo real de build SÍ ocurrió**: 3 WOs (WO-03-006, WO-04-008, WO-05-007) se construyeron
a la vez durante ~4 minutos, con el gate de frd-02 corriendo en simultáneo — la oleada de build tardó
**509,2 s frente a 846,0 s** de suma de los 3 builds individuales (**ahorro ≈5,6 min**, 39,8%). Pero
ese es el ÚNICO tramo de paralelismo real en toda la corrida: **el 65,8% del wall-clock (3457 de
5250 s) y el 84,9% del coste ($49,75 de $58,58) de D2 son gates de FRD SERIALIZADOS** (gate→patch→
verify-patch, uno tras otro para frd-03, frd-04 y frd-05, más el gate de frd-02 corriendo en
solitario 487 s tras terminar el build). **3 FRDs verificadas** (frd-03-portfolio,
frd-04-project-workspace, frd-05-work-orders) + **1 bloqueada** (frd-02-ideas-board, `needs-owner`,
WO-02-014 construida en D1 pero nunca verificada) — el bloqueo es **legítimo**: dos contradicciones
FRD-vs-build reales y pre-existentes (AC-02-010.4/.8), no un bug del código construido; ver BL-0178
para la política inconsistente del oráculo (bloquea aquí, pero la misma clase de deriva pasó sin
avisar en frd-03).

**El número del sprint:** coste por WO verificada (D1+D2 combinado, 3 WOs) = **$21,62** vs **$10,43**
del baseline FRD-24 (**2,07× PEOR**) — *medido con el rollup pre-BL-0181 (~1,6×)*. **Real (BL-0181):
$13,29 vs $6,53 del baseline, 2,04× PEOR** — el factor apenas cambia (2,07× → 2,04×), el veredicto
se mantiene igual. Tiempo por WO verificada = **34,4 min** vs **32,4 min** del
baseline (**prácticamente igual, 6% peor**, sin cambios — el tiempo no lo toca la corrección). El
paralelismo de build que este canario existía para medir NO compensó el coste de los gates seriales
ni el trabajo perdido en D1/frd-02.

**Proyección honesta (marcada, NO medida):** si los 3 gates de frd-03/04/05 corrieran en paralelo en
vez de en serie (el motor no lo permite hoy por diseño, DR-050/BL-0021), el tramo de gates seriales
bajaría de 3457 s al máximo individual (~1117 s) + el gate de frd-02 en solitario (487 s) ≈ 1604 s —
**ahorro proyectado ≈31 min**, llevando D2 a ~56,6 min. El coste NO bajaría (mismo trabajo de agente,
solo reordenado).

**Fixes de tandas anteriores, ¿ejercitados en vivo por D?** BL-0159 (telemetría de gate sin
`apply-gate`) **sí** — `review_end`/`GateVerdict` se emitieron para frd-02 pese a nunca pasar por
`apply-gate`. BL-0154 (puerto e2e fijo a 3900) **sí** — los 4 gates/builds de D2 usaron 6 puertos
distintos, ninguno 3900. BL-0147 (reuse de `verify.sh` en el cierre) **NO** — ambos `notify-end` (D1
y D2) corrieron el `verify.sh` completo sin `--since`, cero eventos `CloseOutVerifyReused` en todo el
histórico de `dashboard-events.ndjson` — ver **BL-0179**, filed nuevo en este cierre.

**Bugs nuevos que destapó D** (todos cerrados en `main`, plugin 9.109.0): **BL-0171** (WOs de `change`
nacen `DRAFT`, sin pasar el gate DR-100 de `/architecture`, pero la misma corrida las construye
igual), **BL-0172** (`notify-end` reescribe `frd.md`/`blueprint.md` vía `sync-rollups` pero
`RELEASE_LEASE` nunca los commitea), **BL-0173** (colapso de oleada por presupuesto de agentes
indistinguible de un tope real), **BL-0174** (`blockFrd` trunca `failure` a 200 chars, enterrando la
causa real bajo elogios), **BL-0175** (un gate bloqueado deja el gate-worktree sucio, degradando C2 al
camino legacy), **BL-0176** (el exit genérico del gate emite `verdict:"fail"` fijo en vez del
`blocked_reason` real), **BL-0177** (`stopReason:'agents'` se reporta aunque no quedara trabajo
real). Dos hallazgos quedan **abiertos, pendientes de decisión del owner**: **BL-0178** (el oráculo de
deriva pre-existente bloquea en un camino y pasa por alto en otro) y **BL-0179** (BL-0147 nunca se
ejercita en vivo — todo gate real emite `scope:since`, solo `notify-end` emite `scope:full`).

**Acción de producto pendiente en MC real (no es trabajo de la fábrica, es del owner sobre su
proyecto):** la forense de frd-02 pide reconciliar **AC-02-010.4** (roster de campaña, desfasado
contra DR-085) y **AC-02-010.8** (contenido nunca construido en `phases.ts`, revertido en `76054e96`
y nunca vuelto a añadir) — vía `/pandacorp:sync` y `/pandacorp:change` respectivamente sobre
`mission-control`. La misma clase de deriva (**REQ-03-001** vs `ACTIVE_PHASES` en `portfolio.ts`) pasó
sin avisar en frd-03 y también queda pendiente de reconciliar. La rama `canary-d-parallelism` (worktree
`/Users/Shared/Proyectos/panda-corp-canary-d`) contiene **3 work orders verificadas de mejora real de
Mission Control** (WO-03-006, WO-04-008, WO-05-007) más 1 bloqueada (WO-02-014) — pendientes de que el
owner decida si aterrizarlas en el `main` de `mission-control`.
