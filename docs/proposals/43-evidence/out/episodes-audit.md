# Auditoría de episodios merge-queue (1–20 nov 2026)

Fuente: `../w-tr/episodes.json`. Scripts: `sample.py` (muestra, seed 7), `ctx.py` (lector de transcripciones), `partb.py` (Parte B; salida en `partb.out`). Solo lectura.

## Errores en el informe original
1. **El proyecto no es mixto**: 61/62 episodios y 137/138 intentos son **funko-tracker**; mission-control tiene **1** intento (EP042, 26 s, aterrizó). La "mediana MC 26 s" es n=1, no una tendencia. (medida)
2. **c = 0 es falso**: en la muestra 2 de 8 rojos no-a/g eran tests inestables/frágiles confirmados en sesión (EP034, EP038). (medida en muestra)
3. **h incluye rojos que la sesión sí diagnosticó** (EP015: fixture de fotos solo presente en la carpeta de otra sesión; EP038: e2e con carrera de conteo, arreglado y 20/20).
4. **rc mal parseado**: EP008 E07.A01 figura rc 0 ("[exited with code 0]" del wrapper), la cola dio `exit=11` (línea 933).
5. **Gates hechos por subagentes no se detectan**: EP046 figura "tests sueltos", pero el `[certified-tree]` dice "full verify.sh … 45s old" en el mismo worktree `wt-news` → hubo verify completo no visto. B4 subestima "verify completo".
6. La causa `h` se asignó también a intentos que no son rojos (códigos 21, hooks, sin fin); el conteo de 60 rojos sí los excluye, pero la muestra estratificada por letra los arrastró (E18.A12, exit 21 con gate verde) — se sustituyó por EP038.

## Parte A — muestra (16 rojos rc 11, seed 7)
| Ep / intento | Orig | Veredicto | Evidencia (≤3 líneas) |
|---|---|---|---|
| EP031 E18.A13 | f | CORRECTA (f-carga; solapa c) | "fallaron 44 pruebas por tiempo agotado… carga de 34 a 5x" (l.5473); reintento esperando carga<14 |
| EP020 E16.A04 | f | CORRECTA (f-DB compartida) | "Database `ft_gate` does not exist" (l.1534); "alguien borró otra vez la base de pruebas" (l.1559) |
| EP034 E22.A01 | f | **INCORRECTA → c** | test de 9 s con límite 20 s; fijo en el test: "give the A-B-A quick test its real budget", serializar BDs temporales (l.304/310) |
| EP014 E13.A04 | f | CORRECTA (f-fixture DB) | re-siembra de `ft_gate` "2074 collectibles… igual que el estado original"; verde (l.455/462) |
| EP016 E14.A01 | f | CORRECTA (f-fixture DB residual) | "reiniciar la base de fixtures… restos de pruebas anteriores" (l.1505) |
| EP054 E27.A20 | f | CORRECTA (f-worktree sin typegen) | "TS2304: Cannot find name 'PageProps'" → `next typegen` y relanza (l.7628/7633) |
| EP011 E10.A01 | a | CORRECTA (gate previo: vitest de área) | "Unused exports (1)" en knip (l.235) |
| EP043 E24.A04 | a | CORRECTA (edición de docs tras el último gate) | FAIL deltaSkillContract AC-07-002.2 (l.4340); edición l.4277 sin gate |
| EP008 E07.A01 | a | CORRECTA (verify l.489, edits l.655/742 después) | "Fallan 2 tests… los dos son de esta rama" (l.948) |
| EP022 E18.A01 | a | CORRECTA (verify l.2562, arreglos con test:focus después) | FAIL PreviewInspect AC-05-004.3 (l.2903) |
| EP001 E01.A01 | a | CORRECTA (sin gate visible) | `"use client" directive must be placed before…` (l.163) |
| EP010 E09.A02 | g | CORRECTA (arreglo f902301e sin lint) | "Formatter would have printed…" (l.75) |
| EP030 E14.A13 | g | CORRECTA (reglas perdidas al resolver conflictos; verificado por subagente parcial) | FAIL franchiseBackfillContract (l.5687) |
| EP049 E27.A10 | g | CORRECTA (arreglo verificado con vitest suelto, l.4787) | FAIL seriesCorrection AC-12-003.4 (l.4835) |
| EP015 E11.A02 | h | **INCORRECTA → f** (fixture de fotos ligada a una carpeta de sesión; ya roja en main) | "no es un fallo de la app, es… preparación de los tests" (l.2922) |
| EP038 E22.A06 | h | **INCORRECTA → c** | "La app estaba bien; el fallo venía de la prueba… 20 de 20" (l.2933) |

**Acierto: 13/16 = 81 %** (f 5/6, a 5/5, g 3/3, h 0/2). Supera el 80 % pero con sesgo sistemático: c infra-detectado y h decidible.

### Subtipos de "f" (23, por diagnóstico registrado; medida sobre texto, no re-leída cada una)
- Timeouts bajo carga de la máquina: **9** (+1 mixto E19.A05). Dos con evidencia de "mismo árbol pasa aislado sin arreglo" (E23.A02 14/14, E27.A06 4/4) → comportamiento de test inestable (c) disparado por carga.
- BD/fixtures compartidos entre corridas/sesiones (`ft_gate` borrada, siembra errónea, residuos): **7**.
- Worktree sin bootstrap/tipos (PageProps ×4, biome ausente, node_modules fuera de raíz): **6**.
- Puerto ocupado / caché: 0 observados.

### Distribución corregida (ESTIMADA)
Extrapolando la muestra: a 19 · **f ≈ 19** · **c ≈ 6–9** · g 7 · e 1 · **h ≈ 3–6**. Con lectura laxa (timeouts por carga = c): f ≈ 12, c ≈ 15.

## Parte B (medida, `partb.py`)
### B1 Por proyecto
| Proyecto | Ep | Intentos | 1er intento aterriza | Pared aterrizado med / p90 | 1 corrida med / p90 | Rojos |
|---|---|---|---|---|---|---|
| funko-tracker | 61 | 137 | 26/61 (43 %) | 29,0 / 272 min | 11,5 / 21,6 min | 60 |
| mission-control | 1 | 1 | 1/1 | 0,4 min | 0,4 min (26 s) | 0 |
| personal-page-v2 / otros | 0 | 0 | — | — | — | — |

Verificación de filas vs `episodes.md`: EP014 (5 vueltas, 112,54 min), EP031 (6, 740,47), EP046 (1, 27,38, certified) coinciden.

### B2 Tiempo de pared (episodios aterrizados, funko): 79,5 h total = **25,3 h ejecutando cola (32 %)** + **54,3 h entre intentos (68 %)**. Episodios con código 21 seguido de otro intento: EP031 69 min, EP047 281 min, EP048 31 min → mediana 69, máx 281 min (n=3; EP028 no aterrizó).

### B3 Resultados de 138 intentos
aterrizó 58 · rojo de gate 60 · conflicto rebase 6 · main ocupado (12/lock) 5 · código 21: 4 · no ejecutó/desconocido 5 (2 hooks, 1 verify previo rojo, 1 interrumpido, 1 indeterminado) · timeout 0. Todo funko salvo 1 aterrizaje MC.

### B4 Gate previo al 1er intento
| Gate detectado | Ep | 1er intento aterriza | 1er intento sin rojo de gate | Rojos totales |
|---|---|---|---|---|
| verify completo | 19 | 5 (26 %) | 9 (47 %) | 27 |
| tests sueltos | 15 | 7 (47 %) | 10 (67 %) | 6 |
| ninguno/desconocido | 28 | 15 (54 %) | 18 (64 %) | 27 |
| --light / --only | 0 | — | — | — |

**No apoya** "gate débil predice rojo": los episodios con verify completo fallan MÁS. Confusores: verify completo se usa en lotes grandes/de integración, el verify suele preceder a ediciones posteriores (EP008, EP022), y la detección pierde gates de subagentes (EP046). n pequeño (15–28), sin control de tamaño de cambio → no concluyente.

### B5 Vueltas: 1 → 30 · 2 → 11 · 3 → 10 · 4+ → 11. Secuencias ≥3 en `partb.out` (p. ej. EP049: f,h,e,g,g,a,h,✓; EP030: a,b,b,b,g,g,✓; EP028: 21,g,f,f,f,h, sin aterrizar).

### B6 certified-tree: ambos en **funko**, no MC. EP046 E26.A03: 10 s, worktree `wt-news`, verify completo 45 s antes en el mismo worktree (por subagente). EP048 E27.A05: 44 s, worktree `wt-neon2`, tras E27.A04 = gate verde + exit 21 (sello de esa corrida). MC: 1 intento, 26 s, worktree, aterrizó sin `[certified-tree]`; la mediana de 26 s es n=1, no se explica por sello ni fallos tempranos.

### B7 Carga concurrente: solo **1/60** rojos solapa con otra corrida de cola en el dataset. Límite: no incluye verify/vitest/builds de otras sesiones (que son la fuente de carga citada en 10 rojos). Cifra de solapamiento real con gates: no medida.
