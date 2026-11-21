# Red-team independiente — propuesta 43 ("listo = certificado", merge < 2 min)

Fecha: 2026-11-20. Solo lectura. Atacados: `S/out/memo-draft.md`, `S/out/decisions-es.md`. Evidencia releída: `S/out/{rules,measure,episodes-audit}.md`, `S/w-tr/episodes.json`, `S/w-ext/funko-tracker-main-reflog.txt`, y el código vivo. Abreviaturas como en el memo: `MQ` merge-queue.sh, `GS` green-stamp.sh, `VS` verify.sh, `WB` worktree-bootstrap.sh (todos de `mission-control/.pandacorp/`), `RB` `plugin/runtime/build/`, `REG` `factory/decisions/registry.yaml`.

Cálculos nuevos de este red-team (todos reproducibles con los ficheros citados; marcados **medido** si son conteos directos y **derivado** si son muestreo/aritmética):
- **55 de 61** episodios de funko lanzaron la primera corrida de la cola **ya con** `PANDACORP_OWNER_RELEASE_OK=1`; 129 de 137 corridas lo llevaban (medido, campo `command` de `episodes.json`).
- main de funko se movió **93 veces en 14 días: 65 ff + 26 commits directos** (10 `docs`, 10 `chore` incl. `chore(memory)` de la rutina de la fábrica y 4 upgrades de overlay, 2 `fix`) + 2 `reset` (medido, reflog).
- `e1ffcfae fix(ingest)…` (commit directo a main de funko, 16:54) se **empujó solo** a `origin/main` a las 17:47:33 ("update by push"), igual que `d98eaccd docs(ingest)` (15:57 → push 16:33) (medido, `git reflog show origin/main`).
- Rojos de funko por periodo: antes del 13-nov 39 episodios, 36 rojos, 1ª corrida aterriza 20/39 (51 %), ≥3 vueltas 12/39; **desde el 13-nov 22 episodios, 20 rojos, 1ª corrida 8/22 (36 %), ≥3 vueltas 9/22 (41 %)** (medido con el `outcome`/`rc` de `episodes.json`; mi conteo, puede diferir ±1 del memo por rótulos "rojo/bloqueo").
- Rojos de entorno (`f`) desde el 13-nov: 7 = **4 × `PageProps` sin generar** (EP047, EP054, EP055 ×2), 1 biome ausente, **2 timeouts por carga**, **0 de base de datos** (medido, campo `diagnosis`).
- Playwright de MC (log de hoy): de 890 tests, **425 corren en los proyectos serie** `desktop`+`mobile` (suma de duraciones 274 s, 1 worker) frente a 465 en los paralelos (416 s de duraciones repartidas en 3 workers ≈ 139 s de pared) (derivado del `verify-mission-control.log`).
- Probabilidad de que main se mueva dentro de una ventana de W min (muestreo uniforme en horas 8-24, 14 días): fábrica W=9 → **7 %**; funko W=25 → 13 %, W=50 → 24 %, W=70 → 31 % (derivado; los "listo" no son uniformes, así que es cota baja).

---

## BLOQUEANTES

### RT-01 · BLOQUEANTE · El dolor se renombra: para el flujo dominante el tiempo total casi no cambia y el título promete otra cosa
- **Escenario.** funko, caso típico (55/61): el dueño ya dio la orden al pedir el cambio. Hoy: el agente termina → cola (gate 24 min si verde, vueltas si rojo) → main; mediana 29 min, p90 272 min. Con la propuesta: el agente termina → `--certify` (el mismo gate de 24 min, las mismas vueltas) → "listo" → land en 10-44 s. El "merge < 2 min" se cumple por definición, pero "listo" llega cuando hoy ya llegaba main. Ganancias reales: −1 gate completo en los 19/62 episodios que verificaban antes (≈ −7 min de media por episodio, derivado: 19×24/62) y lo que quiten las medidas de vueltas; costes añadidos: Vitest sin bail en rojos (hasta +9 min por rojo de Vitest en funko), `vitest related` duplicado en cada certificación, recertificaciones en segundo plano. Escenario honesto: mediana 29 → ~22-27 min, p90 dominado por episodios de 3+ vueltas que la propuesta apenas toca (estimado).
- **Evidencia.** Conteo 55/61 arriba; memo §11 A1 lo admite "en parte", pero TL;DR, título y ficha 1 dicen "merge en menos de dos minutos" sin decir que el dueño ya autoriza al pedir; la "espera de orden" (mediana 69 min) es n=3 de 61 episodios. El encargo pide además que las pruebas sean rápidas: §7 descarta acelerar el gate sin analizar palancas (RT-12).
- **Corrección mínima.** Abrir la ficha 1 y el TL;DR con la cuenta anterior (antes/después, mediana y p90, para el flujo con orden previa y para el de orden diferida). Añadir una línea de trabajo explícita "acortar la certificación" con presupuesto por proyecto (RT-12). Renombrar el objetivo: "listo = mergeable al instante", no "el merge baja de 30 min a 2".

### RT-02 · BLOQUEANTE · Sacar el gate del candado y rebasar ANTES de esperar el candado rompe la convergencia que hoy existe (enmienda no declarada de DR-096)
- **Escenario.** Tres sesiones de funko terminan a las 10:00. §2.1: cada una hace `fetch + rebase` sin candado y **después** espera el candado por proyecto. A certifica M0+A (10:00-10:24) y aterriza (main = M1). B toma el candado a las 10:24 con un árbol M0+B rebasado a las 10:00: certifica 24 min un árbol ya viejo, el land no coincide, recertifica otros 24 min. C igual, detrás. Cada sesión después de la primera paga **dos** gates completos. Y la regla de §3 "cada aterrizaje lanza un `--certify` para **todas** las demás ramas certificadas" multiplica: K ramas en espera → K−1 recertificaciones serie de 24 min por aterrizaje. Hoy esto no pasa: la cola toma el candado, rebasa, gatea y hace ff bajo el mismo candado (MQ:175, 202, 242, 273), así que la segunda sesión siempre gatea sobre el main real. El "A2 deja hueco" del memo usa un aterrizaje cada 3 h, pero el 08 y el 09-nov hubo 15 movimientos de main cada día.
- **Evidencia.** memo §2.1 orden de pasos; §3 "spawns a detached --certify job for every other certified branch"; REG DR-096 "rebase onto current main tip → integration gate … → ff-merge" bajo un único `merge.lock`; reflog (93 movimientos/14 días).
- **Corrección mínima.** Mantener la invariante de DR-096: candado por proyecto (o el de merge) → rebase → gate → (ff si hay orden o es interno) **bajo el mismo candado**; cambiar el "espera 600 s y exit 20" por una fila FIFO con posición visible y sin abandono. Solo en orden diferida (exit 21 hoy) liberar el candado tras el verde. Recertificar como mucho la rama más antigua en espera, nunca todas. Si se mantiene el diseño, declararlo como enmienda de DR-096 en una ficha propia.

### RT-03 · BLOQUEANTE · La recertificación en segundo plano escribe en worktrees de otras sesiones y bloquea sus pruebas
- **Escenario.** B está "certificada" en el worktree de una sesión viva (el dueño le pidió un retoque). Aterriza A. El land de A lanza `--certify` en el worktree de B: `update-index --no-skip-worktree`, `checkout` de config, `git rebase main`, gate de 24 min, re-bootstrap. Si la sesión B edita durante esos 24 min: el gate muere "tree changed/inputs changed", su Stop hook choca con `verify.lock` (exit 75), y su `git commit` compite con el rebase por `index.lock`. En funko, además, el gate toma el lease **de máquina** `funko-tracker-heavy-tests` que serializa todo Vitest con más de 2 ficheros y todo Playwright: durante una recertificación especulativa ninguna otra sesión de funko puede correr su `vitest` de iteración (ni el Stop hook `--light --tests=` con >2 ficheros) — inversión de prioridad: el trabajo especulativo de una rama que quizá nunca aterrice bloquea el trabajo interactivo y la certificación de un "listo" nuevo. Un rojo en segundo plano (carga, inestable) deja a B sin sello y sin dueño que lo atienda; la notificación es ruido que DR-099 prohíbe empujar.
- **Evidencia.** memo §3 fila (a) y §2.1; AGENTS.md "one writer per checkout"; REG DR-099; `funko-tracker/src/test/db/globalPostgres.ts:51-59` y `scripts/test/gateLease.mjs:178-182` (lease salvo watch o ≤ 2 ficheros); `e2e/globalSetup.ts:14-27`.
- **Corrección mínima.** Nunca escribir en el worktree de otra sesión: recertificar (si se mantiene) en un worktree **propio y desechable** del árbol rebasado, con el sello guardado fuera del checkout y ligado a `(árbol, huella)`. Prioridad: una certificación de "listo" nueva siempre adelanta a una recertificación especulativa. Por defecto, recertificar solo cuando el dueño da la orden (no al moverse main), o solo la rama con orden pendiente. Definir qué pasa con un rojo en segundo plano (queda en el registro, PULL en Mission Control).

### RT-04 · BLOQUEANTE · Existe hoy un camino a producción sin gate completo y el §4 no lo lista
- **Escenario.** Sesión directa en el checkout principal de funko (lanzado): `commit fix(ingest)…` en main a las 16:54, y `PANDACORP_OWNER_RELEASE_OK=1 git push` a las 17:47 sin pasar por la cola. El pre-push hook solo comprueba el flag. Llega a producción un árbol al que nadie le exige un gate completo; el hook Stop solo avisa (DR-146 (5)).
- **Evidencia.** reflog de `origin/main` de funko: `e1ffcfae … 17:47:33 update by push`, `d98eaccd … 16:33:28 update by push`, ambos commits directos (no ff); 26 commits directos en 14 días incluidos 2 `fix`; cabecera de `funko-tracker/.git/hooks/pre-push` ("rejects any push … unless PANDACORP_OWNER_RELEASE_OK=1"). El memo §4 dice "Direct commits on main (allowed before launch…)" y no trata el caso lanzado. **No verificado** si alguien corrió un verify completo antes de esos dos push.
- **Corrección mínima.** Añadir la fila "commit directo + push en proyecto lanzado" a §4 y cerrarla: el pre-push de un proyecto lanzado exige además `green-stamp.sh check` verde sobre el árbol de main (o enruta por la cola). Es barato, ataca directamente el criterio "ningún camino con gate más débil" y debería ir en la fase 0.

### RT-05 · BLOQUEANTE · La cuarentena es un gate más débil que llega a producción, y el propio agente puede aplicársela
- **Escenario.** Certificación de una rama de funko roja en `reviewRenderMutationShard2` (timeout). La "repetición diagnóstica" corre solo ese fichero, con la máquina menos cargada: pasa → registro "inestable" (dos resultados opuestos sobre el mismo árbol = la prueba que exige la cuarentena). El agente añade la entrada a `.pandacorp/quarantine.json` **en la misma rama** que certifica (la regla solo pide "diff comprometido"), recertifica verde, el dueño ordena, push a producción. Si el timeout era una regresión real de rendimiento (o un estado compartido entre tests que también existe entre peticiones en el servidor), viaja 14 días a producción; el "dueño" de la entrada es el propio agente; a los 14 días la caducidad pone rojo cada certificación del proyecto y lo natural es renovarla. Además, "misma semilla" no reproduce el orden al correr un subconjunto (la semilla baraja el conjunto de ficheros), así que la repetición no distingue "dependiente del orden" de "inestable por tiempo": ambos salen "inestables" y elegibles.
- **Evidencia.** memo §2.7 y ficha 5 (Recomendada B, sin excluir proyectos lanzados); REG DR-158 "Keep full G3 certification before main"; encargo: "sin ningún camino que diga listo con un gate más débil"; VS:940-952 (semilla sobre `vitest run` del conjunto).
- **Corrección mínima.** En proyectos lanzados: solo registro (opción A), sin cuarentena. Si se mantiene en MC: entradas añadidas solo por un cambio propio ya aterrizado (nunca dentro de la rama que se certifica), con aprobación del dueño por entrada, y sin renovación sin arreglo. La repetición diagnóstica debe reproducir el orden completo (misma semilla sobre el mismo conjunto) antes de llamar "inestable" a nada, y etiquetar aparte "pasa aislado" (posible dependencia de orden o de carga).

---

## IMPORTANTES

### RT-06 · IMPORTANTE · La decisión 2 está inflada y su mecanismo de prueba no puede funcionar
- **Escenario.** MC es interno: no hay orden del dueño, así que el land va justo detrás de la certificación. El único riesgo de sello caducado es que la fábrica mueva main durante los ~9 min del gate: ≈ 7 % (derivado, 127 commits/14 días). El memo estima 40-70 % de sellos frescos con árbol entero y 70-90 % con subárbol, como si hubiera una espera de una hora. Por ~5 puntos se propone el cambio más arriesgado del memo. Además, la "prueba en checkout reducido" no puede certificar: el sparse checkout marca bits skip-worktree y `tree_is_clean` rechaza cualquier entrada `S` (GS:99-100); no se dice si la prueba corre en cada certificación (doble gate) o una vez (y entonces un test nuevo que lea otra ruta no se detecta); y lecturas por glob de directorio (p. ej. "todas las skills del plugin") pasan con menos ficheros sin fallar.
- **Evidencia.** memo §3 "Mission Control: … 40-70 %"; ficha 2; GS:95-101; rules.md §3 (los worktrees sparse marcan skip-worktree); `S/out/rules.md` §8.6.
- **Corrección mínima.** Recomendar A (árbol entero) + preflight de "main ocupado" acotado a los ficheros del ff (§2.2, que es bueno). Dejar el subárbol como opción condicionada a que el log de fase 0 muestre >20 % de sellos de MC caducados por commits ajenos, y rediseñar la prueba como corrida de diagnóstico separada (no certificación), con regla de cuándo corre.

### RT-07 · IMPORTANTE · Lo barato y de mayor impacto está enterrado en las fases 2-4
- **Escenario.** EP055: rojo de Vitest → la cola borra `.next` (MQ:247) → el reintento cae en `TS2304 PageProps` (los tipos viven en `.next/types`, incluido por `tsconfig.json:30`) → otro reintento igual → aterriza. Desde el 13-nov, 4 de 7 rojos de entorno son `PageProps` (≈ 20 % de todos los rojos recientes) y uno es biome ausente. Ni `verify.sh`, ni el bootstrap, ni `package.json` de funko ejecutan `next typegen`.
- **Evidencia.** MQ:247; `funko-tracker/tsconfig.json:26-31`; `grep typegen` vacío en package.json/verify/bootstrap de funko; `episodes.json` EP047/EP054/EP055/EP058.
- **Corrección mínima.** Nueva fase 0.5 que salga antes de `--certify`: `next typegen` antes de `tsc` en verify.sh (o no borrar `.next/types` en MQ:247); comprobación de bootstrap; añadir `TMPDIR`, `npm_config_cache`, `PANDACORP_CLEANUP_SESSION`, `PANDACORP_SESSION_TEMP_BASE` a `controls` (GS:75-82; arregla ya los reintentos tras exit 21 entre sesiones); fila FIFO en el candado; pre-push con sello (RT-04); fixture temporal de MC. Todo esto vale con o sin el rediseño.

### RT-08 · IMPORTANTE · La línea base no es estacionaria: las ganancias prometidas se calculan sobre problemas ya arreglados
- **Escenario.** El preflight (§2.5) comprueba y re-siembra `ft_gate` para "los 7 rojos de BD compartida". Esos 7 son del 5-7 de noviembre; funko los atacó el 06-nov (`256f6767` reset antes de cada Playwright), el 10-nov (`a47799a9`) y el 13-nov (`5d50c114` "per-worker isolated DB/server"), y el `globalSetup` actual crea una BD aislada por corrida en modo prod. Desde el 13-nov hay 0 rojos de BD… y sin embargo la 1ª corrida aterriza menos (36 % vs 51 %) y hay más episodios de ≥3 vueltas (41 % vs 31 %). La proyección "60 → 30-35 rojos" y la meta "≥3 vueltas ≤ 15 %" se apoyan en una mezcla de causas que ya cambió. La frase "per-worktree test databases … owner rejected (MQ:211)" queda desfasada frente a funko real.
- **Evidencia.** `git log` de `e2e/globalSetup.ts`, `scripts/test/e2eWorker.mjs`, `gateLease.mjs`, `globalPostgres.ts`; `e2e/globalSetup.ts:48-58`; conteos por periodo arriba.
- **Corrección mínima.** Reclasificar los 20 rojos posteriores al 13-nov y rehacer las estimaciones con esa mezcla; quitar el chequeo de `ft_gate` del preflight o justificarlo con un rojo reciente; corregir §7 sobre BD por worktree.

### RT-09 · IMPORTANTE · El mayor generador de rojos de entorno (carga) queda intacto y la propuesta añade carga
- **Escenario.** 9 rojos por timeout bajo carga (+2 desde el 13-nov) quedan sin arreglo: solo se etiquetan "environment-suspect" y la certificación sigue roja (cuesta una vuelta). Mientras tanto se añaden gates completos: recertificaciones en segundo plano, gate nocturno, `vitest related` antes de la suite entera (los mismos tests dos veces), repeticiones diagnósticas. El host solo tiene 2 slots pesados (MQ:107-113) y la carga venía de sesiones fuera de esos slots (episodes-audit B7).
- **Evidencia.** memo §2.7 "No admission throttle … out of scope"; §9.3 lo reconoce como riesgo residual; `funko-tracker/vitest.config.mts:31` (`testTimeout: 20_000`).
- **Corrección mínima.** Meter en alcance una medida de carga: o la certificación espera a carga < núcleos antes de empezar (no después del rojo), o los tests de iteración pesados de otras sesiones pasan por el mismo slot/lease; y cuantificar la carga extra que añade el diseño antes de recomendarlo.

### RT-10 · IMPORTANTE · Decisión 6: afirmaciones falsas y evidencia mal atribuida
- **Escenario.** El memo dice que `--no-bail` y `--report-all` "existen" y que Playwright mantiene `maxFailures: 1` en 3 workers. Pero `--no-bail` exporta `PANDACORP_VERIFY_NO_BAIL=1` a todo el proceso (VS:672) y `playwright.config.ts:142, 165-166` lo lee como modo diagnóstico: 1 worker global y sin `maxFailures`. Usado tal cual, **toda** certificación (también la verde) pasa a Playwright de un solo worker, varias veces más lenta. La ficha dice "una certificación verde tarda lo mismo que hoy", falso también por `vitest related` previo. Y la justificación ("7 casos de un fallo ya escondido") no se sostiene: los 3 casos `g` auditados (EP010 formateador, EP030 reglas perdidas al resolver un conflicto, EP049 arreglo verificado con Vitest suelto) son roturas nuevas causadas por el arreglo, no fallos tapados por fail-fast.
- **Evidencia.** VS:208-210, 671-672; MC `playwright.config.ts:142-166`; REG DR-158 ("Combined --no-bail diagnostics use one global worker"); episodes-audit Parte A.
- **Corrección mínima.** Hace falta un flag nuevo solo para Vitest; quitar "related-first" o descontarlo de la suite; reescribir la evidencia (fail-fast queda como hipótesis) y bajar la ficha a "medir primero cuántos rojos tienen ≥2 fallos de Vitest".

### RT-11 · IMPORTANTE · El preflight va antes del rebase: se certifica con `node_modules` viejos
- **Escenario.** main trae un cambio de `pnpm-lock.yaml`. `--certify`: preflight (dependencias al día respecto al lockfile **antiguo**) → rebase (lockfile nuevo) → gate sin reinstalar (verify.sh no instala) → el veredicto vale para dependencias que no son las del árbol. Después, el re-bootstrap ve el lockfile cambiado, reinstala, cambia `node_modules/.modules.yaml` (entra en la huella, GS:67) y el sello deja de coincidir: el land vuelve a pagar el gate completo. Hoy la cola tiene el mismo defecto heredado.
- **Evidencia.** memo §2.1 orden; WB:83-128 (instalación solo en el bootstrap); `grep "pnpm install"` vacío en VS; GS:65-68.
- **Corrección mínima.** Orden rebase → preflight/instalación → gate; que la cola haga lo mismo.

### RT-12 · IMPORTANTE · Las palancas de velocidad de la certificación ni se miden ni se valoran
- **Escenario.** En MC, 425 de 890 tests (los proyectos serie `desktop`/`mobile`, ≈ 274 s de los ≈ 432 s de pared de Playwright) corren en 1 worker porque escriben estado compartido (DR-158 "shared-state writers remain serial"). La copia temporal del fixture por corrida que el propio memo propone (§2.3 v) abre la puerta a una copia **por worker**, y con ella paralelizar ese tramo: MC podría pasar de ~8,7 a ~5-6 min (estimado). En funko, Vitest de hasta 8,9 min y Playwright de 7,8 a 17,3 min (mediana-máx) no se analizan (¿qué parte es arranque de BD, qué parte jsdom, qué parte serie?). El encargo dice "ya había pedido que las pruebas fueran rápidas".
- **Evidencia.** `verify-mission-control.log` (recuento por proyecto); MC `playwright.config.ts:144-200`; memo §7 (descarta sacar Playwright del camino bloqueante, pero no estudia acelerarlo).
- **Corrección mínima.** Sección "acortar la certificación" con un perfil por proyecto (serie vs paralelo, arranque, build) y 2-3 palancas con estimación y riesgo: fixture por worker en MC, revisar el tramo serie, perfil de Vitest de funko. No hace falta comprometer cifras, pero sí dejar de dar el gate por fijo.

### RT-13 · IMPORTANTE · Las métricas de éxito no miden lo que pide el dueño
- **Escenario.** Fase 1 mide `[certified-tree]` y p50 del paso de merge: salen bien por construcción (el merge pasa a ser solo comprobar identidad) aunque el tiempo de "termino de programar → en main" no cambie. Fase 2 compara "certificaciones verdes a la primera" con "aterrizajes a la primera" de otra época (43 %, cuando desde el 13-nov es 36 %).
- **Evidencia.** memo §8 columna "Proof it worked"; conteos por periodo arriba.
- **Corrección mínima.** Métrica principal por episodio: desde la primera `--certify` (o el primer "listo") hasta main, mediana y p90, y vueltas por episodio, contra una línea base contemporánea (log de fase 0 en ≥ 1 semana antes de activar la fase 1).

### RT-14 · IMPORTANTE · Cifras presentadas como medidas que no lo son, y frecuencia de "main avanzó" subestimada
- **Escenario/Evidencia.**
  - §5 y ficha 2 C: "0 of 60 audited reds were caused by main moving (measured)". Solo se auditaron 16; los 60 vienen de un clasificador con 81 % de acierto.
  - §3: la frecuencia de main en funko usa 65 aterrizajes y omite 26 commits directos (28 % de los movimientos), entre ellos los `chore(memory)` de la rutina de la fábrica y upgrades de overlay. Esos commits **no toman el candado de merge**, así que hoy hacen fallar el `ff-only` de una cola en curso con un engañoso exit 12 "main ocupado" (MQ:273-274).
  - §3 "certification-to-merge window of about an hour (owner order median 69 min)": n=3 y aplicable a ~10 % de los episodios (55/61 traen la orden).
- **Corrección mínima.** Rotular "clasificado, no auditado"; contar todos los movimientos de main; hacer que rutinas y upgrades tomen el candado (o lo respeten) y que el exit por main movido sea distinto del de "ocupado".

### RT-15 · IMPORTANTE · Las ramas que añaden rutas visuales nunca dejan sello
- **Escenario.** Rama de MC con una pantalla nueva. Con `updateSnapshots: "missing"` (MC `playwright.config.ts:170`) la certificación escribe la línea base que falta, un fichero no trackeado bajo `e2e/`: el árbol queda sucio y `record` no certifica (GS:121). Como en el nuevo diseño no hay "listo" sin sello, la sesión debe commitear la imagen y certificar otra vez (9 min en MC, 24 en funko). Y DR-080 dice que esas líneas base se bendicen en el gate del FRD, no las decide el implementador.
- **Evidencia.** rules.md §3d; GS:121-123; REG DR-080.
- **Corrección mínima.** Que `--certify` falle rápido y con motivo cuando falte una línea base (antes de gastar el gate), y documentar el paso "bendecir → commitear → certificar".

---

## MENORES

- **RT-16 · Ruta rápida de MC (2 C) mal definida.** "Archivos disjuntos" no es seguro: main cambia un token global de `globals.css` y la rama añade una página; tsc y `vitest related` pasan, pero el visual del árbol combinado falla y llega rojo a main. Además VS:928-937 advierte que `vitest related` recorre todo el grafo y se amplía a todo cuando cambia config/package.json, así que el tope de 120 s salta; no se dice si al pasarlo se falla cerrado. Corrección: si se mantiene, "pasado el tope = recertificar", y nunca con cambios de CSS/tokens/config.
- **RT-17 · Ficha 3 B ofrece empujar a producción sin gate completo.** Está rotulada como contraria a DR-158, pero contradice también el criterio del encargo; mejor quitarla o rotularla "no admisible sin enmendar DR-138/158".
- **RT-18 · La reversión vía cola tarda una certificación completa** (24 min en funko + orden). El memo cita el rollback de Vercel; falta decir que, mientras tanto, main (roto) y producción (revertida) divergen y que el `main-red` debe bloquear cualquier push.
- **RT-19 · El nocturno sobre main puede preparar ramas de reversión ante un rojo inestable o de carga.** Pide la repetición completa antes de proponer una reversión al dueño.
- **RT-20 · "Closes mechanism 1"** (§4, motor): el parche ya se juzga hoy con el siguiente G3 completo; la frase sobrevende.
- **RT-21 · PATH no hasheado.** Un runtime con otros shims (Codex, Homebrew postgres distinto) reutiliza el sello; `node --version` no cubre pnpm, postgres ni los navegadores. Hoy pasa lo mismo con los navegadores; basta con rotularlo.
- **RT-22 · Defensa antifalsificación sobredimensionada.** `check` ya exige el mismo árbol y la misma huella, así que copiar un sello válido entre worktrees idénticos no es un riesgo real; se puede simplificar §2.3 última fila.
- **RT-23 · Ficha 1 opción B formulada a la contra.** Falta la alternativa natural: "listo = la cola llegó a verde (exit 0, o exit 21 con sello que sobrevive)", que con las correcciones de RT-07 da casi todo el beneficio sin partir el candado.

---

## Afirmaciones del memo comprobadas contra código/datos

| # | Afirmación | Resultado |
|---|---|---|
| 1 | La cola restaura `server-env.json`/`launch.json` y quita skip-worktree (MQ:192-201) | Correcta |
| 2 | Espera de candado 600 s → exit 20 (MQ:66) | Correcta |
| 3 | Espera de slot de host infinita (MQ:131-151) | Correcta |
| 4 | Exit 21 llega después del gate (MQ:262-268) | Correcta |
| 5 | La huella del sello incluye todas las variables salvo `controls`, `TMPDIR` incluido (GS:75-87) | Correcta |
| 6 | El Stop hook se salta con sello válido | Correcta (`verify-before-stop.sh`, fast-path DR-146) |
| 7 | DR-138 permite rollback instantáneo como primera medida de incidente | Correcta (REG:815 (3)) |
| 8 | "Both flags exist" para Vitest sin bail con Playwright en 3 workers | **Falsa** (RT-10) |
| 9 | "Una certificación verde tarda lo mismo que hoy" (ficha 6) | **Falsa** (RT-10) |
| 10 | Prueba de entradas "certificando dentro de un checkout reducido" | **Imposible con GS actual** (RT-06) |
| 11 | "0 of 60 audited reds" por main movido, "measured" | **Sobredeclarada** (16 auditados) |
| 12 | MC con árbol entero: 40-70 % de sellos frescos | **Sin base** (≈ 93 % derivado, RT-06) |
| 13 | BD por worktree rechazada; la certificación se serializa por el lease de BD | **Desfasada** (BD aislada por worker/corrida desde el 13-nov; el lease es de máquina para todo test pesado) |
| 14 | Commits directos a main solo antes del lanzamiento | **Contradicha** (26 en funko lanzado, 2 empujados sueltos hoy; RT-04) |
| 15 | El commit de metadatos de aterrizaje entra en el árbol certificado | Correcta (`RB/land/command.mjs` `rebaseOntoMain`/`writeLandingCommit`; árbol estable si la base no cambia) |

---

## (a) Veredicto global

1. El diagnóstico es bueno y honesto en su mayor parte; el diseño **no está listo para el dueño**.
2. Cumple la letra ("listo" = mergeable al instante), pero para el flujo dominante (orden dada de antemano, 55/61) el tiempo total casi no cambia y no ataca la duración del gate que el dueño pidió acortar.
3. Separar el gate del candado y rebasar antes de esperar introduce gates obsoletos y recertificaciones en cascada que hoy no existen, y la recertificación en segundo plano escribe en checkouts ajenos.
4. Deja abierto un camino real a producción sin gate completo (commit directo + push) y propone una cuarentena que es un gate más débil también en producción.
5. Lo de más valor (typegen, controles de entorno, FIFO, pre-push con sello, fixture de MC, log) es barato y debería salir primero, independientemente del rediseño.

## (b) Cambios al memo, por orden

1. Rehacer TL;DR y ficha 1 con la cuenta antes/después para "orden previa" (55/61) y "orden diferida"; añadir la opción "listo = cola verde (exit 0/21) con sello que sobrevive" (RT-01, RT-23).
2. Mantener candado → rebase → gate → ff bajo un solo candado con fila FIFO; o declarar y justificar la enmienda de DR-096 (RT-02).
3. Eliminar la recertificación en worktrees ajenos; si se conserva, worktree desechable propio, sello ligado a (árbol, huella) fuera del checkout y prioridad para los "listo" nuevos (RT-03).
4. Añadir y cerrar en §4 el camino "commit directo + push en lanzado" (pre-push exige sello) (RT-04).
5. Cuarentena: fuera para proyectos lanzados; nunca dentro de la rama que se certifica; repetición diagnóstica con el orden completo (RT-05).
6. Nueva fase 0.5 de arreglos baratos (typegen/MQ:247, bootstrap, `controls`, FIFO, pre-push, fixture MC) antes de `--certify` (RT-07).
7. Decisión 2 → recomendar A + preflight acotado; subtree condicionado a datos; rediseñar la prueba de entradas (RT-06).
8. Reclasificar los rojos posteriores al 13-nov, rehacer las estimaciones y quitar `ft_gate` del preflight (RT-08).
9. Ficha 6: flag solo para Vitest, quitar "related-first" o descontarlo, corregir evidencia; a "medir primero" (RT-10).
10. Orden rebase → instalación/preflight → gate (RT-11).
11. Sección "acortar la certificación" con perfil por proyecto y palancas (RT-12) y una medida de carga en alcance (RT-09).
12. Métrica principal de extremo a extremo con línea base contemporánea (RT-13); corregir rótulos y frecuencias (RT-14); falla rápida por línea base visual ausente (RT-15); menores RT-16..22.

## (c) Lo que el memo hace bien y no debe tocarse

- Rótulo medido/derivado/estimado en casi todas las cifras y tabla de sospechosos con "predice / explica los éxitos": ese es el estándar correcto.
- Diagnóstico del sello inútil con experimento real (MC verde sin sello por escrituras en `e2e/fixtures`) y lectura exacta de GS/WB/MQ.
- Fase 0 (log de la cola + archivo de gate-reports) como oráculo antes de cambiar nada.
- No tocar DR-138, rechazar reintentos automáticos y no sacar Playwright/visual del camino bloqueante.
- Esperas acotadas y preflight de "main ocupado" acotado a los ficheros del ff en MC; fixture temporal por corrida en MC.
