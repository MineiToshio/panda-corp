# Verificación final independiente — propuesta 43 (`docs/proposals/43-done-means-queue-green.md`)

Verificador independiente, solo lectura. Recalculé cifras desde `S/w-tr/episodes.json` + `S/w-tr/annotations.py` (script `S/out/vcheck.py` y consultas ad hoc), leí el código citado y los git logs/reflogs. "l." = línea del memo.

**Veredicto: APTO CON CORRECCIONES** (lista al final). La corrección 1 es un fallo de diseño real y hay que arreglarla antes de adoptar la fase 0.5.

---

## A. Cobertura del encargo

| # | Requisito | Estado | Dónde | Qué falta |
|---|---|---|---|---|
| 1 | Línea de tiempo por etapa + vueltas, medido/estimado | **CUMPLE EN PARTE** | §1.1, §2.5, §6 | El rebase no tiene cifra y §11 no lo da como no medido. Visual no aparece separado de Playwright (ni en MC ni en funko) y no se declara como no medido. En MC las etapas estáticas salen agregadas (19,2 s); `measure.md` tiene cada una. Las medianas por etapa de funko (tsc, knip, madge… en `timeline-ext.md` l.575-590) no se usan. Vueltas: bien (≥3 vueltas, 1.ª corrida aterriza). |
| 2 | Sospechosos descartados con evidencia; predice / explica los éxitos | **CUMPLE EN PARTE** | §1.2 | Falta una fila explícita "rojos de otras sesiones" (candidato mínimo del encargo). Hay evidencia para ella: la etiqueta "trabajo de otra sesión" (1 rojo + 5 intentos no rojos), EP015 (fixture ligada a la carpeta de otra sesión), las 5 salidas "main ocupado". Varias causas confirmadas dejan "Explains the successes" en "—": n.º 3, 9, 10, 12. n.º 3 deja vacío también "Predicts". |
| 3 | Por qué los arreglos rompen otras cosas | CUMPLE | §1.3 | — |
| 4 | Merge de algo certificado ≤ 2 min + casos con main movido | CUMPLE | §3, §6.1, TL;DR 3 | Honesto en que solo aplica a orden diferida sin contención. Ver la corrección 1: el paso 4 de §2.2, tal como está escrito, rompe ese mismo camino. |
| 5 | "Listo" = mismo gate sobre el árbol a mergear; ningún camino más débil | CUMPLE | §2.1, §4 | La parte de redacción no se puede forzar con código, y el memo lo reconoce (§10.7). |
| 6 | Bloqueante vs. fondo, riesgo/detección/reversión, las 5 ideas | CUMPLE | §5, §7, decisiones 4-6 | En §5 varias celdas de riesgo/reversión están en "—". La seguridad de la decisión 5 B depende de una ejecución en segundo plano que no existe si se elige 4 A (corrección 4). |
| 7 | Presupuesto por etapa y proyecto ≤ 2 min + costo movido | CUMPLE | §6.1, §6.2 | Suma bien (45 / 105 / 105 s). El paso "entorno ≤ 10 s" incluye `next typegen` sin medir y un bootstrap (ver D). |
| 8 | Red-team: dos sesiones, test inestable, main movido, DR-138 | CUMPLE | §3, §2.4, §8 último párrafo, §9 | Los red-teams independientes atacaron la v1. La v2 solo la revisó su autor, y la corrección 1 lo demuestra. |
| 9 | Lo no medido/verificado | CUMPLE EN PARTE | §11 | Faltan: tiempo de rebase; tiempo de visual separado; si el sello entregado al checkout principal pasa `check` allí (ver D-3); duración de bootstrap no-op. |
| F | Frases completas, legible, sin términos internos sin definir | **CUMPLE EN PARTE** | todo | Se usan los IDs `EPnnn` y la etiqueta "label a" sin definirlos; el encargo pone "EP055" y "causa f" como ejemplos de fallo. Ver F. |
| F | Mismo idioma/estructura que 40/41 | CUMPLE | cabecera, TL;DR | Inglés, Status/Date/Home, TL;DR numerado, tablas: igual que 41. |

---

## B. Cifras (contrastadas con la evidencia o recalculadas)

| # | Cifra del memo (l.) | Resultado | Valor real / nota |
|---|---|---|---|
| 1 | "Done to main" funko post-13-nov: mediana 28,9, p90 211 min, n=22 (l.27, 46) | **Mal etiquetada** | Se reproduce solo con el campo `wall_s`, que empieza en el "listo" declarado por la sesión cuando se observó (5 de 22 episodios: EP040, 046, 049, 050, 051), no en la 1.ª corrida de la cola como define l.20. Con la definición del memo (`wall_queue_s`): **mediana 25,5 min, p90 209 (rango más cercano) / 193,5 (interpolado)**. |
| 2 | Antes del 13-nov: 38,1 / 276 min, n=35 (l.46) | **Mal etiquetada** | Mismo problema. Con la 1.ª corrida como inicio: **mediana 21,4 / p90 276**. Con la definición del propio memo, la mediana *empeoró* después del 13-nov (21,4 → 25,5); la tabla sugiere que mejoró (38,1 → 28,9). |
| 3 | Corrida verde de la cola: mediana 19,2, p90 24,9, n=19 (l.27, 44, 249) | **Sin fuente / criterio no declarado** | Ningún filtro natural da n=19 ni 19,2: las corridas que aterrizan sin sello dan n=20 y **mediana 17,6**; con las dos de exit 21, n=22 y **mediana 15,7**. 19,2 sale solo de un subconjunto de 19 que no se declara. p90 24,9 sí cuadra. |
| 4 | Antes del 13-nov: mediana 14,6, n=35 (l.44) | Correcta | 14,6, n=35. |
| 5 | Corrida roja: mediana 2,2, p90 10,6, n=22 (l.45) | Correcta (redondeo) | rc=11: 2,3 / 10,6, n=22. |
| 6 | 1.ª corrida aterriza 9/22 y 17/39 (l.47) | Correcta | 9 y 17. |
| 7 | ≥ 3 vueltas: 9/22 y 12/39 (l.27, 48) | Correcta | — |
| 8 | Orden previa: 55/61 episodios, 129/137 corridas (l.27, 50) | Correcta | — |
| 9 | 31,7 % dentro / 68,2 % entre; 25,25 / 79,53 h (l.49) | Correcta, con matiz | Cuadra con `episodes-audit.md` B2. Usa `wall_s`, así que el tramo "entre" incluye el tiempo previo a la cola en los episodios con "listo" observado. |
| 10 | Intervalos tras exit 21: 31, 69, 281 min (l.51) | Correcta | EP048, EP031, EP047. |
| 11 | MC gate 523 s; Playwright 446,7 s (85 %); Vitest 54,5; estático 19,2 (l.44) | Correcta | Suma de las 11 etapas estáticas de `measure.md` = 19,19 s. |
| 12 | 890 tests, 3 workers (l.44) | Correcta | Log l.1600, 2522. |
| 13 | Tier serie 425 tests / 274 s; paralelo 465 / 416 s (l.31, 161) | Correcta | desktop 230 + mobile 195 = 425, 274,3 s; desktop-parallel 330 + mobile-parallel 135 = 465, 415,7 s. |
| 14 | Estático + Vitest 73,7 s (l.250) | Correcta | 54,48 + 19,19. |
| 15 | ppv2 230 s (Playwright 160,6, Vitest 58,0), n=1 (l.44) | Correcta | Suma 230,0 s (`timeline-ext.md` l.1224-1239). |
| 16 | funko sumas de etapas 1408, 1460, 1500 s; 2 de 3 rescates (l.44) | Correcta | Dos `*-rescue/gate-report.json` + uno del worktree. |
| 17 | funko Playwright mediana 7,8 min (n=7), Vitest máx. 8,9 min (n=16) (l.162) | Correcta | 467 950 ms y 533 822 ms. |
| 18 | Main de funko: 91 = 65 ff + 25 directos (14/9/2) + 1 reset (l.52) | Correcta | Reflog recontado. |
| 19 | Fábrica: 44 commits en 7 días, 25 en MC (l.52) | Correcta (deriva de ventana) | Hoy da 43 / 25. |
| 20 | 4 rojos `PageProps` + 1 de biome de 22 (l.30, 64) | Correcta | E27 intentos 1, 20, 24, 25 y 30. |
| 21 | 8 de 22 con etiqueta "a" (l.62) | Correcta | E24.A04 + 7 de E27. |
| 22 | Timeouts por carga: "9 antes del 13-nov, 2 desde" (l.66); "2 recent load-timeout reds" (l.151) | **Incorrecta** | **Desde el 13-nov hay 3** (EP049, **EP060**, EP062). **Antes hay 6** (EP031 ×2, EP028 ×2, EP034, EP039), más 1 mixto (EP028). La auditoría reetiquetó EP034 como inestable. El 9 del memo es el total del periodo, no "antes". |
| 23 | Rojos de BD "7 reds 5-7 Nov" (l.65) | **Fecha incorrecta** | Los 7 van del **1 al 8 de nov.** (EP001 el 1-nov, EP021 ×2 el 8-nov). |
| 24 | "About 5 of 22 environment reds" (l.252; también §10.2) | Mal etiquetada | Los rojos de entorno post-13 son **8** (4 PageProps + 1 biome + 3 carga). Los 5 son los que se quitan mecánicamente; el texto debe decirlo así. |
| 25 | 2 landings con `[certified-tree]`: 10 s y 44 s, n=2 (l.29, 70, 179, 239) | Correcta, pero incompleta | **EP047, intento 3: aterrizó en 12 s tras un exit 21**, sin marcador capturado. Casi seguro es un 3.er aterrizaje por sello y el 2.º tras una orden diferida; refuerza el argumento. |
| 26 | 2 `[certified-tree]` / 28 `[full-gate]` / 108 sin marcador (l.70) | Correcta | 138 − 30. |
| 27 | 19 de 62 episodios con verify completo previo; 5/19 frente a 47-54 % (l.63, 254) | Correcta | B4. |
| 28 | 6-9 de 60 inestables (estimado) (l.67) | Correcta como estimación | — |
| 29 | MC 8,7 → 5,5-6,5 min (estimado) (l.31, 161) | Base aritmética plausible | 274/3 ≈ 91 s → Playwright ≈ 250 s → gate ≈ 5,7-6,1 min. |
| 30 | funko "después" 22-27 / 120-180 min (estimado) (l.252) | **Sin base propia** | Es la cifra del red-team (RT-01) para la v1 sobre la base 29/272 de todo el periodo, trasladada sin recalcular a la base post-13-nov y a la v2. Rotular como "juicio, base RT-01" o recalcular. |
| 31 | Ficha 3: "main se mueve unas 6 veces al día" | Correcta (derivada) | 91/14 = 6,5. |

---

## C. Afirmaciones sobre el código

| # | Afirmación (l.) | Resultado |
|---|---|---|
| 1 | `merge-queue.sh:247` borra `.next` tras el gate (l.64) | ✓ `rm -rf -- .next .next-fidelity test-results` (solo en la rama de gate completo). |
| 2 | `funko-tracker/tsconfig.json:30` incluye `.next/types` (l.64) | ✓ |
| 3 | Ningún script de funko ejecuta `next typegen` (l.64) | ✓ (ni `package.json` ni `.pandacorp/*.sh`). |
| 4 | `record … \|\| true` en `verify.sh:626` (l.71, 309) | **Línea incorrecta**: `record` está en **628**; la 626 es `invalidate \|\| true`. Lo sustancial es correcto (el rango 620-629 lo cubre). |
| 5 | Trap EXIT antes de `acquire`; `release` sin comprobar propietario (`merge-queue.sh:162-175`) (l.73) | ✓ trap l.174, acquire l.175, `release() { rm -rf "$LOCK"; }` l.71. |
| 6 | El slot pesado falla abierto (`:128`) (l.74) | ✓ `mkdir -p "$root" … \|\| return 0`. |
| 7 | Un ff fallido por avance de main sale como "main busy" exit 12 (`:273-274`) (l.72) | ✓ |
| 8 | Entrega del sello entre ff y push (`:291-305`) (l.124, 169) | ✓ |
| 9 | Reconcile buscado en la raíz de la fábrica; MC nunca reconcilia (`:313`) (l.124) | ✓ `MAIN_WT` = checkout de `main` = raíz de la fábrica para MC (l.35-36); `/…/panda-corp/.pandacorp/change-reconcile.mjs` no existe. |
| 10 | `--no-bail` deja Playwright con 1 worker (`playwright.config.ts:142, 165-166`) (l.149) | ✓ (en el tier combinado). `updateSnapshots: isCI ? "none" : "missing"` l.170 ✓. |
| 11 | `jobs.mjs:28` solo `g2` y `land` (l.108) | ✓ |
| 12 | `land/command.mjs:98-102` quita la orden solo al actor `drive` (l.293) | ✓ `landJobEnv`. |
| 13 | Lease de máquina de funko, 45 min (`gateLease.mjs:182-195`) (l.77) | ✓ |
| 14 | El sello hashea todo el entorno salvo `controls` (TMPDIR incluido) y `e2e/` (l.70, 134) | ✓ `green-stamp.sh:65-87`. |
| 15 | El pre-push solo comprueba la variable (l.32) | ✓ cabecera de `funko-tracker/.git/hooks/pre-push`. |
| 16 | `d98eaccd` y `e1ffcfae`: commits directos publicados hoy (l.32) | ✓ reflog de `main` ("commit:") y de `origin/main` ("update by push"). |
| 17 | Scripts idénticos en los 3 proyectos (l.76) | ✓ (`diff -q` sin salida para merge-queue y green-stamp). |
| 18 | `merge-queue.sh:188` hace fetch del checkout local (disposiciones M11) | ✓ |

---

## D. Coherencia interna

1. **Presupuesto:** suma bien. MC 5+15+10+10+5 = 45 s; funko y ppv2 45+60 = 105 s ≤ 120 s. Las 10 s de "entorno no-op" no tienen base: incluyen `next typegen`, que §2.2 paso 4 corre siempre y §11 da como no medido, y un bootstrap.

2. **BLOQUEANTE NUEVO: el paso 4 de §2.2 contradice el código y el propio memo.** "Environment preparation after the rebase: bootstrap idempotently…" va *antes* del check del sello (paso 5) y del gate (paso 6). Pero `worktree-bootstrap.sh:166-222` reescribe el `e2e/server-env.json` trackeado (puerto por worktree) y le pone skip-worktree. Los tres proyectos tienen ese archivo. Consecuencias:
   - (a) `merge-queue.sh:209-212` sale con **exit 11** si `e2e/server-env.json` difiere de HEAD; el propio comentario BL-0288 dice "no pre-gate bootstrap".
   - (b) `green-stamp.sh` `tree_is_clean` (l.95-101) rechaza cualquier entrada `S`, así que el check del paso 5 **nunca** coincidiría.
   - (c) Se deshace la restauración de config que hizo funcionar EP048, la misma en la que se apoyan §2.3 (fila de bootstrap) y la disposición M05.

   La fase 0.5, tal como está escrita, rompería todas las corridas de la cola o el camino por sello. El arreglo es acotar el paso: "solo dependencias, si cambió el lockfile + typegen + herramientas; sin reescribir el puerto ni tocar skip-worktree", y añadir un test.

3. **Slot pesado doble.** §2.2 paso 6 hace que la cola tome un slot y §2.4 hace que verify.sh "itself" tome otro en modo completo. Si no se hereda el token, una corrida de la cola ocupa los 2 slots, y dos corridas a la vez pueden bloquearse entre sí (cada una con uno, esperando el otro). Hay que especificar que verify hereda el slot del llamador.

4. **Pre-push y entrega del sello (§2.6).** "Queue landings pass because the queue already hands its stamp" no está verificado:
   - `check` en el checkout principal re-hashea sus *propios* `node_modules` (metadatos de instalación), `e2e/` (incluidos los ignorados), `.env*` y `.pandacorp/run/lane.env`, que pueden no coincidir con los del worktree;
   - el hook se ejecuta con el entorno que le da git.

   Si falla, el ff ya está hecho y el push se rechaza (estado de exit 13). Hay que rotularlo como no verificado en §11. El test `test-pre-push-requires-stamp.sh` ya está previsto; debe cubrir exactamente este caso.

5. **Decisiones vigentes que se enmiendan sin declararlo** (l.293):
   - **DR-153** gobierna el pre-push ("git pre-push guard follow BUILD-13/14"; el armado exige "a verified pre-push hook"). La decisión 2 lo cambia y no aparece.
   - **DR-141** acepta como evidencia "the full `verify.sh` that certified that exact combined tree"; el cambio de receta (§2.1, §4: "plain verify.sh is a diagnosis tool") lo toca.
   - La regla de calidad "a missing visual baseline on a genuinely-new route = bless at the FRD gate, not a failure" (DR-056/080): `verify.sh:671` exporta `PANDACORP_E2E_CERTIFICATION=1` en **todas** sus corridas (light y since incluidas), así que `updateSnapshots: "none"` bajo certificación también afecta al gate de feature. Declararlo, o limitarlo a `GATE_SCOPE=full`.

6. **Decisión 5 B frente a 4 A.** §5 y la ficha 5 dicen que los tests excluidos "siguen corriendo en el gate nocturno o de fondo". Ese gate solo existe con la decisión 4 B, y la recomendada es 4 A. Con la combinación recomendada (4 A + 5 B), un test excluido en MC no corre en ningún sitio. Además, la caducidad máxima de 14 días aparece solo en la ficha, no en el memo.

7. **BLOQUEANTES de los red-teams, contra el texto v2:**

| Hallazgo | ¿Sigue resuelto en el memo? |
|---|---|
| RT-01 (dolor renombrado) | Sí: TL;DR 1-3, §1.4, §10.1. El título conserva "two-minute owner landing", aceptable porque TL;DR 3 lo acota. |
| RT-02 (gate fuera del candado) | Sí: sección crítica única, FIFO, enmienda de DR-096 declarada. |
| RT-03 (escritores de fondo en worktrees ajenos) | Sí para las ramas. Con la decisión 4 B, §5 no dice **dónde** corre el navegador "on main's tip": si es en el checkout principal compartido de la fábrica, escribe `.next` y fixtures ignorados donde trabajan otras sesiones. Hay que especificar un worktree propio y desechable. |
| RT-04 (producción sin gate) | Sí: §2.6, decisión 2, con el riesgo de D-4. |
| RT-05 (cuarentena autoservida) | Sí: solo registro; exclusiones solo por el dueño y ninguna en proyectos lanzados por defecto. |
| M01 (lock) | Sí (fase 0.5). |
| M02 (verde sin sello) | Sí en lo esencial (fase 1). Queda abierta la parte de M02 "sin verify ejecutable se omite todo el bloque" (`merge-queue.sh:226,253`): el memo no la menciona. |
| M03 (identidad parcial de MC) | Sí: árbol completo. |
| M04 (refs mutables / escritores de fondo) | Sí: ff y push del SHA gateado, sin escritores de fondo. **El paso 4 (D-2) reintroduce una mutación del worktree entre el rebase y el check**, aunque sea del propio checkout bajo candado. |

---

## E. Fichas de decisión (`S/out/decisions-es.md`)

- **Formato:** las seis tienen opciones con letra, exactamente una recomendada, el porqué y qué la cambiaría.
  - Ficha 1: el Contexto **no es un párrafo**: es un párrafo, una lista de 3 viñetas y otra frase. Hay que condensarlo.
  - Opciones sin ganancia/riesgo: 1 D ("Nada."), 2 C ("Dejarlo como está."), 4 C ("Nada…"). CONV-20 pide para cada opción qué se hace, qué se gana y qué riesgo tiene.
- **Coincidencia con el memo:**
  - Ficha 1 repite "29 min" y "211 min" con la definición mal rotulada de B-1/B-2.
  - Ficha 3 dice "las dos veces que el sello sobrevivió… 10 s y 44 s" como coste de *tu paso final tras esperar*. EP046 (10 s) no fue una orden diferida; la que sí lo fue y falta es EP047 (12 s).
  - Ficha 5 añade "caducidad de como mucho 14 días" y "seguiría corriendo en segundo plano", que no están en el memo; esto último falla con 4 A (D-6).
  - Ficha 6: los topes de ejemplo (30 s / 10 s) no están en el memo; están rotulados como ejemplo, así que pasan.
- **Decisiones implícitas que faltan o deberían nombrarse:**
  - (a) La enmienda de DR-153 y de la regla "missing baseline = bless" queda escondida dentro de "adoptar el plan" (ficha 1). Basta con nombrarlas allí.
  - (b) Ficha 1 B ("solo fases 0 y 0.5") no dice que el pre-push de la ficha 2 vive en la fase 1 (§8). Elegir 1 B + 2 A es incoherente si no se mueve el pre-push.
- **¿Inflada?** La ficha 3 recomienda C = seguir como hoy, sin coste nuevo. Es casi una nota informativa: se puede fusionar como línea dentro de la ficha 1, o mantenerla diciendo que no cambia nada.

---

## F. Términos internos sin definir

| l. | Término | Problema |
|---|---|---|
| 62 | `label "a"` | Etiqueta del clasificador sin definir; es exactamente el ejemplo "causa f" del encargo. |
| 64, 66-70, 82, 136 y otras | `EP047`, `EP054`, `EP055`, `EP049`, `EP062`, `EP010`, `EP030`, `EP034`, `EP038`, `EP046`, `EP048` | El formato de ID de episodio no se define en "Terms used" (l.19 define "Episode", no "EPnnn"). |
| 69, 344 | `land-25-1`, `land-25-2` | IDs de trabajos del motor; se entienden por el contexto, pero no se definen. |
| 44, 198 | "engine rescue runs", "Engine rescue", "sparse unit worktree" | Sin definir. |
| 108 | `g2` | Tipo de trabajo del motor sin definir. |
| 118, 155 | engine `harvest`, "patch unit" | Sin definir. |
| 137, 293 | `lane.env`, "`drive` actor" | Sin definir. |
| 134 | "`plugin-sync`'s reads" | Sin definir. |
| 49, 58, 63, 71, 73-74, 135, 139 | "B2", "B4", "Part A", "M01", "M02", "M03", "M08", "M12" | Referencias a secciones y hallazgos de archivos de evidencia temporales. Cada fila trae su explicación, pero las etiquetas, solas, son del tipo "RT-07". Mejor citar por título, o añadir una línea en Terms. |
| 285 | exit 13 | Usado sin definir (10/11/12/14/16/17/20/21 sí se explican). |

---

## Correcciones (en orden de importancia)

1. **§2.2 paso 4 (l.118) y §8 fase 0.5 (l.286):** sustituir "bootstrap idempotently (reinstalls when the rebase changed the lockfile)" por: "dependencies only: reinstall when the rebase changed the lockfile, `next typegen`, tool presence; it never rewrites `e2e/server-env.json`, `.claude/launch.json` or sets skip-worktree (that would trip `merge-queue.sh:209-212` exit 11 and make `green-stamp.sh` `tree_is_clean` refuse every stamp)". Añadir el test `test-merge-queue-env-step-keeps-committed-config.sh`.
2. **l.20, 27, 46 y ficha 1:** definir la métrica como se calculó ("from the session's first observed 'ready' or, if none, its first queue run") o recalcular con la 1.ª corrida: post-13-nov **25,5 / 209 min**, antes **21,4 / 276 min**. Corregir el contraste antes/después.
3. **l.27, 44, 249, 180 y fichas 1-3:** declarar el criterio de "green queue run, n = 19, median 19.2" o sustituirlo por el reproducible: aterrizajes sin sello post-13-nov, **n = 20, mediana 17,6, p90 24,9 min**.
4. **§2.4 l.151 / §2.2 paso 6:** "verify.sh inherits the caller's host slot (token in the environment); the queue never holds two slots".
5. **l.66 y l.151:** "load-timeout reds: 6 before 13 Nov (+1 mixed), **3** since (EP049, EP060, EP062)". l.252 / §10.2: "8 environment reds since 13 Nov, of which 5 have a mechanical fix here".
6. **l.293 (Decisions in force):** añadir DR-153 (pre-push guard), DR-141 (evidencia de verify previo en la integración por lotes) y la regla "missing baseline = bless" (DR-056/080). Limitar `updateSnapshots: "none"` a `GATE_SCOPE=full` o declarar que afecta también al gate de feature.
7. **§5 fila "Excluded tests" y ficha 5:** decir dónde corren los excluidos si se elige 4 A (por ejemplo, "an owner-started background run in a disposable worktree"), o condicionar 5 B a 4 B. Llevar la caducidad de 14 días al memo.
8. **§2.6 l.169 y §11:** "Queue landings are expected to pass… **not verified**: `check` re-hashes the main checkout's own dependencies, ignored `e2e/` files and `.env*`; the phase-1 test decides it".
9. **§5 (decisión 4 B):** "the background run uses its own disposable worktree at main's tip, never the shared factory checkout".
10. **§1.2:** añadir la fila "Reds caused by other sessions' work" (1 rojo con la etiqueta "another session's work"; EP015; 5 salidas "main busy") con veredicto y evidencia. Rellenar "Explains the successes" en las filas 3, 9, 10 y 12, o escribir "n/a: no success depends on it".
11. **Terms used (l.10-21):** añadir "**EPnnn** — an episode id in `S/w-tr/episodes.json`"; sustituir "label "a"" (l.62) por "the classifier's label *own defect not covered by the earlier gate*"; definir rescue/g2/harvest/patch unit/`drive` actor/`lane.env`, o eliminarlos.
12. **l.65:** "7 reds 1-8 Nov". **l.71 y 309:** `verify.sh:628`.
13. **l.29, 70, 179:** añadir "a third, unmarked 12 s landing after an exit 21 (EP047) very probably took the same path".
14. **l.252:** rotular 22-27 / 120-180 como "judgement carried over from the design red-team's v1 estimate" o recalcular sobre la base post-13-nov.
15. **§11:** añadir el tiempo de rebase, el visual separado de Playwright y la duración de un bootstrap/typegen no-op como no medidos.
16. **Fichas:** reducir el Contexto de la ficha 1 a un párrafo; dar ganancia y riesgo a 1 D, 2 C y 4 C; en la ficha 1 B, decir que el pre-push (ficha 2) es de la fase 1; en la ficha 3, sustituir EP046 por EP047/EP048 como ejemplos de orden diferida.
