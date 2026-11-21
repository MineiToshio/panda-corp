# Disposiciones de los hallazgos del red-team — propuesta 43 v2

Memo final: `/Users/Shared/Proyectos/panda-corp/docs/proposals/43-done-means-queue-green.md`. "§" se refiere a secciones de ese memo. "Verificado" = comprobado por mí en esta sesión contra código o datos.

## Red-team de diseño (`redteam-design.md`)

| Hallazgo | Disposición | Dónde / por qué |
|---|---|---|
| RT-01 El dolor se renombra; 55/61 traen la orden | **Aceptado** (verificado: 55/61 episodios, 129/137 corridas con `PANDACORP_OWNER_RELEASE_OK=1`) | TL;DR 1-3, §1.1, §1.4, §10.1; objetivo reformulado como gate × vueltas |
| RT-02 Gate fuera del candado rompe la convergencia de DR-096 | **Aceptado** | §2.2 sección crítica única; §7 fila v1 rechazada |
| RT-03 Recertificación de fondo escribe en worktrees ajenos | **Aceptado** | Eliminada; §3 "no background re-certification"; §7 |
| RT-04 Camino a producción sin gate (commit directo + push) | **Aceptado** (verificado en reflog de `origin/main`: `d98eaccd` 16:33, `e1ffcfae` 17:47, "update by push") | §2.6, §4 fila nueva, decisión 2 |
| RT-05 Cuarentena auto-servida, también en producción | **Aceptado** | §2.4 registro de sospechosos; exclusiones solo por el dueño (decisión 5), ninguna en lanzados por defecto; §7 |
| RT-06 Decisión 2 inflada; prueba sparse imposible | **Aceptado** | §2.3 última fila: identidad = árbol entero de la fábrica; §7 |
| RT-07 Lo barato enterrado (typegen, MQ:247) | **Aceptado** (verificado: `tsconfig.json:30` incluye `.next/types`; ningún script de funko ejecuta `typegen`; 4/22 rojos recientes son `PageProps`) | Fase 0.5, §2.2 paso 4, §2.4 |
| RT-08 Línea base no estacionaria (13-nov) | **Aceptado** (verificado: `5d50c114` el 13-nov; 0 rojos de BD desde entonces). Mi recuento difiere ±1: 1ª corrida aterriza 9/22 y 17/39 (el red-team, 8/22 y 20/39); lo indico en §1.1 | §1.1 todo recalculado en la ventana post-13-nov; preflight de BD eliminado (§7) |
| RT-09 La carga queda intacta y el diseño añadía carga | **Aceptado en parte** | Aceptado: slot pesado para todo gate completo, cerrado ante fallo, y registro de carga (§2.4); sin trabajo de fondo nuevo. No aceptado ahora: limitar los tests ad-hoc de otras sesiones o esperar a baja carga antes del gate; queda pendiente de los datos de la fase 0 (§10.5) porque no hay medida de cuánto pesan |
| RT-10 Decisión 6 con afirmaciones falsas | **Aceptado** (verificado: `verify.sh:671-672` exporta `PANDACORP_VERIFY_NO_BAIL`; `playwright.config.ts:142` lo lee como modo diagnóstico con 1 worker) | §2.4: flag nuevo solo para Vitest, fuera de la certificación; "related first" eliminado; fail-fast queda como hipótesis (§1.2 n.º 7) |
| RT-11 Preflight antes del rebase | **Aceptado** | §2.2 paso 4 (después del rebase, bajo candado, reinstala si cambió el lockfile) |
| RT-12 Palancas de velocidad sin valorar | **Aceptado** (verificado: 425 tests serie, 274 s sumados; 465 paralelos, 416 s sumados) | §2.5; fase 2 |
| RT-13 Métricas de éxito que no miden lo pedido | **Aceptado** | §8 fase 0: métrica "de terminar a main" con línea base contemporánea; fase 1 la usa como prueba |
| RT-14 Cifras sobredeclaradas y frecuencia de main subestimada | **Aceptado** (verificado: 25 commits directos + 65 ff + 1 reset en 14 días; el red-team contó 26 + 2 reset) | §1.1, §1.2 n.º 13, §2.2 (exit 17 distinto de 12 y candado para commits directos) |
| RT-15 Ramas con rutas visuales nuevas nunca dejan sello | **Aceptado en parte** | Aceptado: `updateSnapshots: "none"` bajo certificación, rojo explícito "línea base sin bendecir" y paso documentado (§2.3). No aceptado: detectar la línea base ausente *antes* del gate, porque no hay una forma barata de conocer los nombres de captura sin ejecutar las pruebas |
| RT-16 Ruta rápida de MC mal definida | **Aceptado** (resuelto al eliminarla) | §7 |
| RT-17 Opción de producción rápida | **Aceptado** | Eliminada (§7) |
| RT-18 La reversión tarda una certificación y main/producción divergen | **Aceptado** | §5: rollback de Vercel mientras se arregla main; la marca `main-red` bloquea aterrizajes y redespliegue (decisión 4 B) |
| RT-19 El nocturno puede preparar reversiones ante inestables | **Aceptado** | Sin nocturno automático con reversión; solo en la decisión 4 B y sin reversión automática |
| RT-20 "Closes mechanism 1" sobrevende | **Aceptado** | §2.4: el parche sigue juzgado por la siguiente cola; se añade la comprobación previa |
| RT-21 PATH no hasheado | **Aceptado** | §2.3: PATH y HOME siguen hasheados; navegadores, fuentes y código generado rotulados como límites |
| RT-22 Antifalsificación sobredimensionada | **Aceptado** | Eliminada (§2.3 nota final, §7) |
| RT-23 Falta la alternativa "listo = cola verde" | **Aceptado** | Es el diseño v2 (§2.1) |

## Red-team mecánico (`redteam-mech.md`)

| Hallazgo | Disposición | Dónde / por qué |
|---|---|---|
| M01 El timeout de un contendiente borra el candado del dueño | **Aceptado** (verificado: trap EXIT en `merge-queue.sh:174` antes de `acquire`; `release` hace `rm -rf` sin comprobar la propiedad) | §1.2 n.º 11, §2.2 paso 1, fase 0.5 |
| M02 Verde del proceso ≠ sello; el respaldo aterriza sin él | **Aceptado** (verificado: `verify.sh:626` `record … \|\| true`) | §1.2 n.º 9, §2.2 paso 6 (se exige el sello antes del ff, después del arreglo de fixtures de MC) |
| M03 La identidad parcial de MC no falla cerrado | **Aceptado** | Identidad de árbol entero (§2.3, §7) |
| M04 Escritores de fondo y referencias mutables en ff/push | **Aceptado** | Sin escritores de fondo; ff y push del SHA gateado (§2.2 pasos 8-9) |
| M05 Certify devuelve un worktree donde su propio sello ya no vale | **Aceptado en parte** | Ya no hay `--certify` separado. El trap re-bootstrapea tras el exit 21, pero la siguiente corrida restaura la config antes del check (EP048 aterrizó con sello en 44 s); el puerto sale del archivo trackeado en la fase 2 (§2.3) |
| M06 PATH y HOME no son de ubicación; mismo entorno para todos los lectores | **Aceptado** | Sin `env -i`; se amplía la lista `controls` que usan todos los lectores vía `green-stamp.sh`; PATH y HOME siguen hasheados; `--explain` (§2.3) |
| M07 Copias de sello y entradas ignoradas | **Aceptado en parte** | Aceptado: límites declarados (`node_modules`, clientes generados, navegadores) en §2.3. No aceptado como riesgo nuevo: copiar un sello entre worktrees con el mismo árbol y las mismas entradas (el check ya exige ambas; misma conclusión que RT-22) |
| M08 Copiar fixtures en globalSetup llega tarde | **Aceptado** | Se sustituye por salidas declaradas que se borran antes de la huella inicial y se excluyen de ella; el sandbox completo queda diferido con este hallazgo como especificación (§2.3) |
| M09 El preflight muta recursos compartidos antes del candado y del rebase | **Aceptado** | Paso de entorno bajo candado y tras el rebase, sin re-siembra de BD (§2.2, §7) |
| M10 El runner no soporta certify; el fan-out no converge | **Aceptado** (verificado: `jobs.mjs:28` solo `g2` y `land`) | No hay tipo de trabajo nuevo; exit 16 mapeado en `harvest` (§2.1, §2.2) |
| M11 ≤ 120 s sin cota mecánica | **Aceptado** (verificado: `merge-queue.sh:188` hace fetch del checkout local, no de origin) | §6.1 plazo único con el resto para cada espera; reconcile fuera; push con "resultado desconocido"; la contención se declara explícitamente |
| M12 El tope de dos gates pesados falla abierto | **Aceptado** (verificado: `merge-queue.sh:128` `mkdir … \|\| return 0`) | §2.4 slot para todo gate completo, cerrado ante fallo, protocolo único; tope de 1 a 2 según CPU |
| M13 Los flags existentes no dan "Vitest sin bail y Playwright igual" | **Aceptado** | Flag nuevo `--diagnose-unit` (§2.4) |
| M14 La cuarentena puede ocultar un defecto; una repetición de subconjunto no reproduce el orden | **Aceptado** | Sin repetición de subconjunto; registro por observaciones naturales con árbol, semilla, worker y proyecto; exclusiones solo por el dueño, por ID exacto, con caducidad que también caduca el sello (§2.4, §5, decisión 5) |
| M15 El log no es un oráculo; el criterio de la fase 0 es imposible | **Aceptado** | §8 fase 0: UUID por intento, evento de inicio durable, eventos de ff y push, archivo inmutable por intento; se cruzan con el reflog solo los eventos ff |
| M16 Orden de autorización incompatible | **Aceptado** | §2.2 pasos 7-8: la orden se comprueba antes de ff y push; el flag nunca se hereda a trabajos de fondo; un reintento tras caducar vuelve a pasar el gate (§8 "Decisions in force") |
| M17 Sumas y extrapolaciones presentadas como medidas | **Aceptado** | §1.1 rotula sumas de etapas, n y finalidad de cada informe; sin regla de tres; los porcentajes de frescura quedan eliminados |
| M18 Alcance anidado y aviso del Stop hook | **Aceptado** (verificado: no existe `change-reconcile.mjs` en la raíz de la fábrica, así que los aterrizajes de MC nunca reconcilian) | §2.1 (el aviso es informativo; el control determinista está en la cola y la CLI), §2.2 paso 10 |

## Afirmaciones del red-team que no pude confirmar exactamente

- Conteo de movimientos de main de funko: 25 commits + 65 ff + 1 reset (mi reflog, 14 días) frente a 26 + 65 + 2 (red-team). Diferencia de ventana; no cambia ninguna conclusión.
- Primera corrida que aterriza: 9/22 y 17/39 (mío, con `outcome` que empieza por "aterriz") frente a 8/22 y 20/39 (red-team). Las dos cuentas se publican en §1.1.
- "≈ 7 % de que main se mueva durante un gate de MC de 9 min": cálculo del red-team, no reproducido; se cita como suyo en §7.

## Verificación final (`final-verification.md`, correcciones 1-16) — todas aplicadas en la v3

| Corrección | Disposición |
|---|---|
| 1 Paso de entorno reescribe `server-env.json` | Aceptada (verificado: `worktree-bootstrap.sh:177-222`, `merge-queue.sh:209-219`). §2.2 paso 4 limitado a dependencias + `typegen` + herramientas; test `test-merge-queue-env-step-keeps-committed-config.sh`; fila en §7 |
| 2 Métrica mal rotulada | Aceptada (recalculado con `v3counts.py`: Q 25,5/209 y 21,4/276; R 29,0/211 y 38,1/276). La estimación "después" de funko se sustituye por un what-if mecánico (sin cambio) y "no recalculable" |
| 3 Corrida verde 19,2 n=19 | Aceptada: mi 19,2 era mediana por rango más cercano con n=20; con mediana estándar 17,6 (n=20, p90 24,9). Criterio declarado |
| 4 Doble slot | Aceptada: verify hereda el slot (§2.2 paso 6, §2.4) |
| 5 Enmiendas no declaradas | Aceptada (verificado `verify.sh:671` exporta la certificación en toda corrida): DR-141, DR-153 y regla de captura ausente declaradas; `updateSnapshots: none` solo en alcance full |
| 6 5 B frente a 4 A | Aceptada: gate nocturno en worktree desechable dentro de la decisión 5; 14 días en el memo |
| 7 Pre-push en checkout principal | Aceptada: marcada no verificada; prueba principal = evento del log de la cola |
| 8-16 Forma, cifras y fichas | Aceptadas. EP047: 13,5 s según `duration_s` (el verificador dio 12 s); se publica "≈ 13 s" |
