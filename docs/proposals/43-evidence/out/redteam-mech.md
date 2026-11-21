# Red-team mecánico independiente

Revisión de solo lectura del memo completo, con el código y la evidencia disponibles el 20-11-2026. Los escenarios siguientes son contraejemplos por inspección; no se ejecutaron colas, gates, tests, builds, servidores ni operaciones Git de escritura. El único archivo creado es este informe. No se ha implementado ni validado dinámicamente la propuesta.

Rutas usadas para que las citas sean inequívocas:

- `F` = `/Users/Shared/Proyectos/panda-corp`.
- `MC` = `F/mission-control`; `FT` = `/Users/Shared/Proyectos/funko-tracker`; `PP` = `/Users/Shared/Proyectos/personal-page-v2`.
- `RB` = `F/plugin/runtime/build`.
- `S` = `/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad`.
- `memo` = `S/out/memo-draft.md`. Las citas con estos prefijos son archivo:línea, relativas exclusivamente a esas raíces.

Comparé por SHA-256 las cuatro copias de merge-queue, green-stamp, worktree-bootstrap y change-reconcile: MC, FT, PP y plantilla coinciden. Los problemas de esos scripts aplican a los tres proyectos; las diferencias de aplicación se indican expresamente.

## Hallazgos

### M01 — BLOQUEANTE — El timeout de un contendiente borra el candado del propietario

**Escenario.** A adquiere el lock de merge y tarda en push/reconcile o en el fallback de gate. B espera; alcanza los 120 s propuestos (600 s hoy), sale con 20 y ejecuta el trap EXIT. Ese trap llama incondicionalmente a `release`, que hace `rm -rf "$LOCK"`, aunque B nunca lo adquirió. C adquiere el directorio recién borrado mientras A sigue dentro. A también puede borrar después el candado de C. Resultado: dos aterrizajes con exclusión mutua perdida. El refresco de mtime no protege contra esto.

**Evidencia.** `MC/.pandacorp/merge-queue.sh:56-71,162-175`: trap instalado antes de `acquire`; `fail` durante acquire termina el proceso; release no comprueba posesión. `memo:141,212-219` reduce la espera sin corregir el protocolo. Es un defecto actual que la propuesta hereda y vuelve más probable con el timeout menor.

**Corrección mínima.** Token único de propietario y flag adquirido, liberar solo el lock propio; reclaim mediante rename y nueva comprobación de identidad, nunca borrar el directorio de otro. Aplicar la misma disciplina al nuevo lock de certificación y al semáforo shell de host. Cubrir timeout de B mientras A sigue vivo.

### M02 — BLOQUEANTE — Verde del proceso no garantiza certificado; el fallback puede aterrizar sin él

**Escenario.** Un full empieza con entradas I0; durante el gate cambia un fixture ignorado y termina con I1. Los tests acaban verdes pero `record` rechaza el sello. `verify.sh` devuelve 0 porque ignora ese rechazo. Si `--certify` reutiliza «record as today», puede devolver 0 sin certificar; si land conserva el fallback de hoy, este hace full y ff basándose solo en rc=0. La identidad final nunca tuvo una corrida completa con entradas estables. MC ya tiene evidencia de verde sin sello; no es una posibilidad meramente teórica.

**Evidencia.** `MC/.pandacorp/verify.sh:413-416,620-629,1020-1021`; `MC/.pandacorp/green-stamp.sh:119-124`; `MC/.pandacorp/merge-queue.sh:226-253,273-275` no exige un sello después del full. `S/out/measure.md:40,46-55` documenta precisamente el rechazo. `memo:98,101,103` conserva el mecanismo y el fallback.

**Corrección mínima.** Certify debe exigir report full verde + record exitoso + comprobación final de identidad, y fallar si no existen. También el fallback de land debe exigirlos antes de ff; ausencia de verify ejecutable hoy incluso omite todo el bloque (`merge-queue.sh:226,253`), por lo que debe pasar a error explícito. No equiparar rc=0 de verify con certificación.

### M03 — BLOQUEANTE — La identidad parcial de MC no falla cerrado ante lecturas nuevas

**Escenario.** Se añade una lectura de `../plugin/…` protegida por `existsSync` o catch, sin actualizar certify-inputs. En sparse no existe: el lector devuelve fallback y los tests pasan. En el checkout completo sí existe y cambia el comportamiento. Otro commit modifica solo ese archivo omitido: la identidad propuesta no cambia y el árbol combinado aterriza con un sello de una ejecución distinta. Un nightly posterior detecta tarde y puede ni siquiera ejercitar esa rama. El memo reconoce el fallback, pero sigue presentando sparse como prueba de completitud.

**Evidencia.** Lecturas reales externas: `MC/src/lib/architecture/data-model/_tests/injected-rule-contract.test.ts:7-18`; `MC/src/app/manual/_tests/manual-content-v2.test.tsx:110-117`; `MC/src/app/projects/[slug]/_components/tab-summary/_tests/build-v2.test.ts:11-16`. El lector real `MC/src/lib/plugin-sync/plugin-sync.ts:76-89,120-132,225-230,263-269` transforma archivos ausentes en null/unknown sin lanzar. `memo:115,147,248,265,276` no propone denegar o registrar toda lectura omitida. `MC/.pandacorp/green-stamp.sh:92,159-165` hoy sí invalida por cualquier cambio del árbol completo.

**Complicación adicional.** El sparse checkout usa skip-worktree, justamente prohibido por `green-stamp.sh:95-100,108`. El motor demuestra que sparse requiere esos bits (`RB/units/worktrees.mjs:223-226`). La receta no puede simultáneamente certificar sparse «como hoy» y mantener esa prohibición. Cone mode tampoco equivale a un sandbox de archivos: `.git`, rutas absolutas y enlaces siguen siendo otras vías de lectura.

**Corrección mínima.** Mantener identidad de fábrica completa hasta contar con aislamiento que deniegue lecturas no declaradas, incluidas sondas de existencia, procesos hijos y enlaces, y trate esa denegación como error aunque la app capture ENOENT. Separar ese sandbox del índice Git usado para certificar. Un inventario por rg y una corrida sparse no son esa garantía.

### M04 — BLOQUEANTE — El background añade escritores sobre ramas/worktrees que land supone inmóviles

**Escenario.** A comprueba el sello de la rama R en T. Una recertificación automática o una sesión reanudada modifica R después del check: por ejemplo, main recibe un commit directo permitido y el background rebasa R sobre él. A hace `merge --ff-only R`, resolviendo el nombre de rama de nuevo; ahora fusiona T', descendiente del nuevo main, sin haber comprobado ni gateado T'. ff-only comprueba genealogía, no la identidad certificada. Incluso antes de ese punto, dos certify del mismo worktree restauran configuración/rebasan antes de adquirir el lock de proyecto y pueden interferir con el gate activo. El lock verify solo cubre verify, no esos preparativos.

**Evidencia.** `MC/.pandacorp/merge-queue.sh:202,227,273,302`: referencias mutables en rebase, merge y push. `MC/.pandacorp/green-stamp.sh:135-153` suelta su lock al salir del check. `MC/.pandacorp/verify.sh:50-77` no protege rebase/bootstrap. `memo:98,152,161,181` introduce rebase sin merge lock, recertificación de ramas ajenas y conserva commits directos en main. `RB/land/command.mjs:125-140` comprueba HEAD antes de lanzar el job, sin proteger toda su vida posterior.

**Corrección mínima.** Certificar snapshots detached de un SHA fijado, sin tocar checkouts de sesiones activas; reservar exclusión del checkout antes de toda mutación. Land debe fijar tip/base, comprobar el certificado de ese tip y fusionar ese SHA inmutable bajo exclusión; verificar que main sigue siendo la base admitida. Push debe publicar el SHA que acaba de validar, evitando recoger commits directos posteriores. Con colas cooperantes y referencias fijas, main divergente hace fallar ff; no es lícito reutilizar el sello tras rebase a otra identidad.

### M05 — IMPORTANTE — Certify devuelve un worktree en el que su propio sello ya no coincide

**Escenario.** Certify obtiene sello con puerto comprometido, luego ejecuta bootstrap como manda §2.1 y devuelve 0. Bootstrap vuelve a modificar server-env y marca skip-worktree. El check requerido para declarar «listo» falla inmediatamente, aunque main no se haya movido. Stop vuelve a correr light. En MC una creación o cambio adicional de `.env.local` también cambia inputs. Restaurar el puerto al entrar a land puede recuperar la coincidencia, pero no hace verdad el contrato «listo = check actual verde» tras certify.

**Evidencia.** `memo:98,167,171`; `MC/.pandacorp/worktree-bootstrap.sh:177-223,247-253`; `MC/.pandacorp/green-stamp.sh:65-71,95-100,161-165`. `PP/.pandacorp/worktree-setup.sh:26-35` puede además ejecutar un build de hasta 90 s para generar content-collections; no es solo restaurar un número de puerto.

**Corrección mínima.** No rebootstrapear automáticamente después de certificar, o alojar el certificado en un snapshot estable y ofrecer un check de la identidad de certificación que no confunda overrides de iteración con los bytes certificados. Ese check debe demostrar qué configuración será restaurada, sin ignorar arbitrariamente entradas S. Separar bootstrap de preparación y restauración ligera del puerto.

### M06 — IMPORTANTE — PATH y HOME no son variables de mera ubicación; falta el mismo entorno en los lectores

**Escenario.** Certificar con PATH A y luego aterrizar con PATH B, ambos con el mismo `node --version`, cambia pnpm/Python/binarios nativos sin invalidar el sello propuesto. Cambiar HOME mueve tanto la caché de navegadores como la configuración instalada que MC lee. Una herramienta ausente de la allow-list puede activar un fallback que pasa, no necesariamente fallar «loudly». Además, certify bajo env -i y `green-stamp check` bajo el ambiente normal de land/Stop producen huellas diferentes si solo se cambia el lanzador de verify.

**Evidencia.** `memo:114,277,312`; `MC/.pandacorp/green-stamp.sh:65-87,164-165` solo verifica versión de Node, no ejecutables resueltos ni navegadores. `MC/src/lib/plugin-sync/plugin-sync.ts:215-218,255-269` prueba que HOME cambia entradas funcionales. `MC/.pandacorp/merge-queue.sh:227,291`; `F/plugin/scripts/verify-before-stop.sh:97` invocan check directamente. `MC/e2e/prod-server.mjs:10-15,31` y `MC/playwright.config.ts:40-47,218` reinyectan valores desde archivos: env -i por sí solo no controla todo el entorno efectivo.

**Corrección mínima.** Un único resolvedor de entorno para start/record/check, cola y Stop; fijar o identificar ejecutables reales/versiones de pnpm, Python, navegador y bindings usados. Pin de HOME/recursos leídos o hashes de sus entradas funcionales. Distinguir restricciones nuevas de riesgo expresamente aceptado: 12 h es caducidad, no detección de drift dentro de esas 12 h.

### M07 — IMPORTANTE — Cambios ignorados y copias de sellos siguen pudiendo reutilizar evidencia ajena

**Escenario.** W1 y W2 tienen el mismo árbol y metadatos de instalación. W2 contiene otro cliente Prisma generado o una modificación local dentro de node_modules, sin alterar lockfiles. Copiar sello + reporte genuino de W1 a W2 conserva los valores que el diseño enumera: full, green, misma identidad Git, digest correcto e id real en el log. No hace falta falsificar tres artefactos. El reporte actual ni siquiera identifica las entradas completas o el checkout. Editar verify.sh sí invalida hoy; editar cualquier ignorado leído por tests no está cubierto por esa garantía.

**Evidencia.** `MC/.pandacorp/green-stamp.sh:39-40,65-72,127,154-165`: metadatos de deps, no contenido instalado ni identidad física del worktree. `FT/.gitignore:18-19` ignora el cliente generado que el código importa (`FT/src/queries/storedCopies.ts:12`). `PP/.pandacorp/worktree-setup.sh:26-35` produce otro módulo ignorado consumido por tsc/app. `MC/.pandacorp/verify.sh:580-587` reporta sha/seed, sin inputs ni worktree. `memo:118,252,316` afirma que el cruce bloquea copias, pero no define un vínculo obligatorio con el checkout consumidor.

**Corrección mínima.** Reporte y sello con identity digest completo, gate digest, entorno efectivo, id único y checkout/snapshot de origen; validarlos contra un registro común. Si se permite transferencia, exigir equivalencia completa del destino y un traspaso explícito como el de main (`merge-queue.sh:288-295`), no solo copiar archivos. Regenerar inputs ignorados de forma determinista o incorporarlos al hash; invalidar al reinstalar/reparar dependencias. Declarar por separado que no se hashea todo node_modules, límite actual de DR-158 (`F/factory/decisions/registry.yaml:938`).

### M08 — IMPORTANTE — Copiar fixtures en globalSetup llega tarde y separa servidor y tests

**Escenario.** Se copia la raíz y se redirige solo PANDACORP_FACTORY_ROOT. `commands.spec.ts` crea su tarjeta en la ruta original, mientras la app lee la copia: el selector nunca ve la tarjeta. Otros specs siguen borrando/escribiendo el original, por lo que el hash e2e sigue cambiando. Si se crea la copia solo en globalSetup, el build ya ocurrió con el entorno original y el propio setup de funko constata que webServer ya está escuchando. HOME, eventos y host también siguen apuntando a la raíz antigua. El fixture de cuentas escribe incluso un vault hermano fuera de factory-root.

**Evidencia.** `memo:117`; `MC/.pandacorp/verify.sh:987-994` construye antes de Playwright; `MC/e2e/prod-server.mjs:10-15,31` carga el JSON y da precedencia al fixtureEnv. `MC/playwright.config.ts:40-47,163,203-218` materializa serverEnv desde config. `FT/e2e/globalSetup.ts:55` explica el orden del servidor. `MC/e2e/commands.spec.ts:6-20,49-55`; `MC/e2e/cuentas.reviewer.spec.ts:6-8,23-26,59-60`; `MC/e2e/server-env.json:3-7` muestra las cinco raíces a redirigir. `snapshotLedger.ts:96-127` es solo uno de muchos escritores.

**Corrección mínima.** Crear un sandbox por corrida antes de build y de cargar config; pasar el mismo descriptor a build, servidor, workers y todos los specs. Resolver rutas en un helper único; copiar/aislar también hermanos necesarios y evitar symlinks hacia originales. Conservar semillas canónicas inmutables; no clonar residuos ignorados de una corrida previa. No cambiar el JSON trackeado durante el gate para pasar la ruta temporal.

### M09 — IMPORTANTE — El preflight modifica recursos compartidos antes del candado y antes del rebase

**Escenario.** A construye/prerenderiza el artefacto e2e usando ft_gate, antes de que el servidor escuche en 4037; B empieza certify y, antes del lock de proyecto, ve el puerto libre y un fingerprint distinto y reseedea. `DROP DATABASE … WITH (FORCE)` destruye la base que usa A. O B prepara deps/tipos con el lockfile viejo y luego rebasa un cambio de dependencias: el gate ya no usa la preparación comprobada. El puerto puede estar libre en preflight y ocupado al arrancar; certificar dos sesiones sin revalidarlo bajo lock produce un rojo tardío. Un gate manual de uno o dos specs puede resetear la base sin retener lease.

**Evidencia.** Orden propuesto `memo:98,126`; bootstrap solo usa hash de lock para saltar install (`MC/.pandacorp/worktree-bootstrap.sh:83-128`), no garantiza tipos actuales tras rebase. `FT/e2e/prod-server.mjs:11-18` retiene el lease durante reset+build, sin servidor escuchando todavía. `FT/scripts/fidelity/db.mjs:100-107,123-152` recrea/reseedea; `FT/scripts/test/gateLease.mjs:181-195` omite lease en watch o ≤2 archivos y tiene timeout 45 min. `FT/e2e/globalSetup.ts:18-27,44` aplica ese criterio incluso al reset del setup. `FT/src/test/db/globalPostgres.ts:51-60` hace lo mismo en Vitest. `FT/package.json:31-34` ofrece up/down/check-clean/purge, no un comando de fingerprint de la siembra. `FT/scripts/db/testPostgres.mjs:210-239` comprueba residuos, no igualdad de ft_gate con la semilla. PP y MC no tienen scripts db:test:* en package.json.

**Corrección mínima.** Rebase a SHA fijado primero; luego preparación del árbol final. Toda inspección con reparación de DB requiere el lease común antes de tocarla; el nuevo lock debe estar en git-common-dir + prefijo de proyecto y ser compartido por todos los consumidores del recurso. Definir orden único checkout/proyecto/lease/slot y evitar volver a adquirir un lease ya retenido sin token heredado. Revalidar/reservar puerto bajo el lock; el preflight no lo reserva. Mapear «ocupado» separado de defecto, sin prometer 10-60 s para una migración+siembra de duración no medida.

### M10 — IMPORTANTE — Ni el runner ni el estado actual soportan certify; el fan-out puede no converger

**Escenario.** Se lanza kind=certify mediante el runner existente: spawnJob lo rechaza. Si se disfraza de land, su exit 0 se interpreta como aterrizaje y se exige que main contenga la rama; si se disfraza de g2, se adquiere un slot además del de la cola. Dos jobs con doble adquisición pueden consumir los dos slots esperando otro. El nuevo exit 15 tampoco tiene mapeo. Además, 10 ramas certificadas que requieren recertificación serial de 24 min consumen 240 min: otra llegada de main a las ~3 h vuelve obsoletas parte de ellas. «Resto de un gate» no es una cota del tiempo de espera.

**Evidencia.** `RB/jobs.mjs:28,62-64,78-90,102-114,265-277`; `RB/schemas/state.schema.json:668-673`; `RB/land/batch.mjs:15-25`; `RB/land/harvest.mjs:52-59,154-157,221-248`; `RB/next/landing.mjs:9-22`. `memo:102,152,161,175-176,221,310` no especifica el nuevo estado, adopción, deduplicación por rama/base ni prioridades. `land/command.mjs:30-40,88-94,134-140` rebasa y reescribe metadatos antes de cada intento, algo que no puede repetirse automáticamente entre certify y land sin revisar identidad.

**Corrección mínima.** Nuevo tipo y transiciones separadas certified/waiting-owner/landed, esquema y harvest compatibles con transferencia de epoch; exit 0 de certify nunca significa landed y exit 15 tiene política propia. Un único dueño del slot, sin doble adquisición. Registro durable de candidatas, debounce/coalescing por tip/base, cancelación de resultados obsoletos y prioridad al land solicitado. Recertificar snapshots, no ramas activas. La separación es viable, pero requiere cambios cruzados del motor y no es «solo relabel G3».

### M11 — IMPORTANTE — El presupuesto ≤120 s no tiene una cota mecánica, aun con certificado fresco

**Escenario.** Land espera 110 s por el merge lock, 30 s por un light del mismo checkout, 5 s en fetch local, 5 s en rebase y 15 s en el resto: MC tarda 165 s con sello fresco. En FT/PP un push lento añade minutos. Si el sello no coincide, el fallback vuelve a mantener el merge lock durante full+slots; una recertificación en background y el land pueden además duplicar ese full.

**Evidencia.** `memo:103,107,141,210-221` asigna 120 s al lock y otros 60 al check sin un deadline compartido. Camino real en `MC/.pandacorp/merge-queue.sh:30-36,50-70,183-219,227-247,256-275,286-317,162-172`. `git fetch` es del checkout local de main (`:188`), no de origin; **no actualiza main desde GitHub**. Push sí usa origin (`:302`) y puede fallar con main local ya avanzado. `MC/.pandacorp/change-reconcile.mjs:85-108,192-209` recorre historial y hace consultas Git por rutas sin timeout; best-effort solo tolera su código de error, no lo vuelve asíncrono.

**Recálculo por proyecto.** Para un sello fresco, NO quedan host slot, test DB ni gate/sonda de puerto: el script los salta. Tampoco hay bootstrap normal de éxito hoy; sí lo hay en salidas no cero posteriores a restore, incluido 21. Se conserva este desglose explícito; las cifras adversas son estimaciones ilustrativas bajo carga, no mediciones ni máximos garantizados:

| Paso real | MC, FT, PP: rango adverso razonable (s) | Observación |
|---|---:|---|
| Espera merge lock propuesta | 0-120 | Hoy 0-600; propiedad rota en M01 |
| Topología, status, restore config y jq | 2-10 | Fábrica grande/WIP; el dirty inicial sigue siendo de todo el repo |
| Fetch local | 1-10 | Disco/procesos/hooks; sin deadline |
| Rebase | 1-30 | Cantidad de commits y hooks; conflicto devuelve 10 |
| Check de sello | 1-65 | Hasta 60 s esperando verify + git/hash/tool startup |
| Sonda puerto | 0 | Solo fallback/certify; ocupado devuelve 14 antes del full |
| ff | 1-5 | Debería usar SHA fijado, M04 |
| Segundo check y hand-off de sello | 1-5 | La tabla del memo omite que hay otro check completo |
| Reconcile | 1-30 | Síncrono, recorre historial; no tiene cota real |
| Push + pre-push | MC 0; FT/PP 2-90 | También puede no terminar o terminar con resultado incierto |
| Limpieza normal y unlock | 0-2 | No elimina el worktree; no incluye session-cleanup posterior |
| **Suma de extremos ilustrativos** | **MC 277; FT 367; PP 367** | **No es techo: hay llamadas sin timeout** |

En fallo/exit 21 se suma bootstrap: instalación con fallback de red, hooks y port probing; PP puede añadir sus 90 s de content-collections (`PP/.pandacorp/worktree-setup.sh:33-35`). Si se incluye limpieza de sesión/árbol como «merge», falta medir ese paso: la cola solo informa de hacerlo después (`merge-queue.sh:277-285,317`).

En certificado obsoleto se añaden: wait del proyecto sin valor numérico definido; host slot hasta 30 min propuestos, infinito hoy (`merge-queue.sh:124-151`); lease FT hasta 45 min **en cada adquisición**; y gate, migraciones/siembras. `FT/scripts/fidelity/db.mjs:49-60,95,103` tiene procesos y pg_advisory_lock sin timeout global. `RB/admission/hostSlots.mjs:95-102` también espera infinito por defecto. Los 9/25/4 min de `memo:221` son muestras de servicio, no upper bounds.

**Corrección mínima.** Definir SLO condicional de tramo final sin contención o deadline global con presupuesto restante para cada espera/subproceso; no un timeout independiente de 120 s para el primer paso. Sacar reconcile del tramo crítico. Ante identidad obsoleta, soltar merge lock y devolver waiting-certification; no gatear allí. Un timeout de push debe registrar resultado desconocido y reconciliar refs antes de repetir: matar el cliente no deshace un push aceptado.

### M12 — IMPORTANTE — El tope de dos gates pesados no está garantizado por los candados actuales

**Escenario.** Una sesión usa otro HOME/PANDACORP_HOST_DIR y obtiene su propio conjunto de dos slots; la otra usa el normal. O el mkdir del directorio falla y la cola prosigue sin semáforo. Otro caso: muere el wrapper dueño del slot pero sus hijos de verify/Next siguen vivos; se reclama el slot y arranca otro gate pesado. Un nuevo lock por proyecto serializa certifies cooperantes del mismo proyecto, pero no estos procesos ni los ad-hoc.

**Evidencia.** `MC/.pandacorp/merge-queue.sh:117-128,153-155`: PID del shell y fail-open al crear root; `RB/admission/hostSlots.mjs:7-10,24-28,56-85`: namespace dependiente del entorno y PID del wrapper. `RB/jobs.mjs:247-248,265-280` documenta reclaim cuando muere el wrapper. Shell hace reclaim con rm directo (`merge-queue.sh:142-144`), mientras Node usa rename y ownership al liberar (`hostSlots.mjs:35-44,79-83`). `memo:136,251,278` reconoce los ad-hoc, pero usa «dos slots» como capacidad firme.

**Corrección mínima.** Directorio de admisión canónico, estable para los participantes que se pretenden limitar; fail-closed si no se puede usar. Protocolo de owner/token/reclaim compartido entre Node y shell; supervisión del grupo de procesos antes de liberar/reclamar. No contabilizar ad-hoc como limitados si deliberadamente quedan fuera. El máximo actual calculado es de 1 a 2 según CPU, no universalmente 2 (`merge-queue.sh:107-112`).

### M13 — IMPORTANTE — Los flags existentes no permiten «Vitest sin bail y Playwright igual»

**Escenario.** Implementar §2.6 con `verify.sh --report-all --no-bail` exporta el mismo flag a Playwright, que pasa a un worker global, maxFailures=0 y sin dependencias de éxito: cambia justo el tier que el memo dice conservar. Si un static sale rojo, `--report-all` termina antes de Vitest: tampoco muestra «every unit and static failure in one red run». Añadir `vitest related` antes del full agrega trabajo también en verde y puede pagar otra adquisición de lease FT; no es coste exclusivo de rojos.

**Evidencia.** `memo:130,227-232,328`; `MC/.pandacorp/verify.sh:202,220-221,671-672,912-917,941-952`; `MC/playwright.config.ts:142-166,187-199`. Los flags sí existen, su semántica no es la descrita. Un tiempo máximo histórico de la suite tampoco acota futuros fallos/hangs ni la pasada related.

**Corrección mínima.** Controles independientes para bail de Vitest y diagnóstico de browser; definir si static rojo permite ejecutar tests y cómo se acumula el veredicto. Medir el coste adicional de related en verde, manteniendo la pasada full y el sello full solo después de ella. No usar el presupuesto ±0 del motor sin incluir estos nuevos trabajos.

### M14 — IMPORTANTE — Diagnóstico puede quedarse rojo; cuarentena sí puede ocultar un defecto real

**Escenario.** Un bug de concurrencia falla en la suite completa y pasa al correr solo su archivo con la misma semilla. Eso no reproduce el orden, trabajadores, DB ni los tests previos: dos resultados opuestos no prueban que el fallo sea del test. Se lo pone en cuarentena, el gate lo excluye y la rama entra verde con el bug real. Cinco entradas pueden excluir cientos de tests si una entrada admite un archivo/glob. Tras expirar una entrada, un sello de antes de la expiración puede saltar el gate hasta su límite de 12 h si check solo comprueba JSON/edad; la expiración se evalúa durante gate, que ya no corre.

**Evidencia.** `memo:134-135,198,244-245,266`; `MC/.pandacorp/verify.sh:941-952` baraja solo los seleccionados y escribe el reporte de esa corrida; `green-stamp.sh:166-167` solo tiene caducidad global. El nuevo lector de cuarentena y su aplicación en start/record/check aún no existen. `RB/land/harvest.mjs:76-106` hoy tiene un retry automático de docs-only que el memo llama «no retries anywhere»: una futura corrida verde podría saltarse la memoria del rojo si no se vinculan ambas.

**Corrección mínima.** La repetición diagnóstica conserva siempre el rojo original y su reporte, también con error/interrupción, y no se lanza como un verify anidado que chocaría con el lock (`verify.sh:53-68`). Registrar identidad de test/parametrización/proyecto/browser y estado de fixture, además de seed. Cuarentena por IDs exactos, revisión explícita del riesgo de producto y cobertura excluida en reporte/sello; no etiquetar ese resultado como full íntegro. check debe caducar en `min(at+12h, primera expiración)` y el sentinel debe incluir explícitamente los excluidos. El diseño «diagnóstico nunca vuelve verde» es correcto; dos outcomes por sí solos no autorizan considerar inocuo el defecto.

### M15 — IMPORTANTE — El log propuesto no es todavía un oráculo de certificación y su criterio de fase 0 es imposible

**Escenario.** Una invocación roja, un certify exitoso y un land con exit 21 generan tres filas y cero ff. Por tanto «una fila por invocación» no puede igualar el número de ff del reflog. Dos corridas con mismo árbol y mismo segundo pueden escribir `<utc>-<tree>.json` en el mismo nombre; archivar reportes de worktrees distintos sin id único permite colisiones. Un SIGKILL antes del único append final deja un intento invisible. El reporte actual solo contiene sha/seed: no se puede auditar retrospectivamente inputs/entorno/identidad de subárbol uniéndolo por SHA.

**Evidencia.** `memo:118,122,262-265`; `MC/.pandacorp/verify.sh:127-130,580-587,616-628` sobreescribe, escribe sin rename y certifica best-effort. Los checks parciales de Stop también lo reemplazan. `MC/.pandacorp/merge-queue.sh:267,273,302-304` separa no-ff/ff/push; exit 13 es un ff exitoso con push fallido, omitido de la lista de pruebas de fase 0. No hay hoy log propio de cola.

**Corrección mínima.** UUID por intento, eventos start/terminal y eventos ff/push durables, append de un registro completo con protocolo entre procesos; archivo inmutable por run ID, escrito y publicado atómicamente bajo el dueño del reporte. Guardar identidad completa y estados parciales antes/después de ff/push; enlazar sello→reporte→run antes de devolver éxito. Comparar solo eventos ff confirmados contra rangos de reflog, distinguiendo commits directos, fallos y reintentos. Log/archivo común resuelto por project-prefix para proyectos anidados.

### M16 — IMPORTANTE — El contrato de autorización/exit 21 tiene dos órdenes incompatibles

**Escenario.** Si se implementa literalmente «certificate matches: fast-forward; launched projects check the owner's order and push», una rama sin orden ya mueve main local antes de devolver 21. Hoy 21 deja main intacto. Un retry tras 13 h debe volver a certificar aunque llegue la orden; el flag no renueva el sello. Si además se toma la decisión 3 de §12 como permiso para un quick check de producción, se contradice el cierre «full gate before push» y la política de §3. No basta decir que DR-138 queda unchanged.

**Evidencia.** `memo:107` frente a `:98,151-154,325,330`. Código actual: `MC/.pandacorp/merge-queue.sh:256-275` comprueba orden **antes** de ff y `:301-306` publica después. `MC/.pandacorp/green-stamp.sh:23,166-167` fija 12 h. `RB/land/command.mjs:98-102` quita el flag únicamente para actor drive: un CLI autorizado puede heredarlo; los nuevos jobs de background deben eliminarlo expresamente. `F/factory/decisions/registry.yaml:815,936` exige orden por cambio y full G3 antes de main.

**Corrección mínima.** Especificar y probar: certify nunca ff/push ni exige orden; land revalida identidad+edad, comprueba orden y solo después hace ff+push. No heredar el flag a background/recert/sentinel ni reutilizarlo para otro cambio. Separar claramente exit 0 certified de exit 21 waiting-owner en el motor. Retirar la alternativa de producción rápida o declarar qué política modifica, en vez de afirmar simultáneamente que conserva el full.

### M17 — IMPORTANTE — Varias «medidas» son sumas parciales o extrapolaciones, no cotas de pared

**Escenario.** Se dimensiona una recertificación FT con un máximo de 25 min obtenido de tres reportes. Dos son rescates de unidades, no aterrizajes; sus sumas no incluyen todas las esperas ni overhead de cola. Con backlog/lease el plazo se excede sin violar ningún stage budget. Se usa además cero causas atribuidas a main en una muestra de 16 rojos como si fueran 60 casos auditados y se aplica regla de tres a aterrizajes sin observar la variable relevante.

**Evidencia.** `memo:44,70,196,221,229,310`; `S/w-ext/timeline-ext.md:603,617,621,1245` llama expresamente a esas cifras «suma de etapas, excluye preflight/esperas/overhead». `S/out/episodes-audit.md:13,33,41-42,67,71,73` limita la muestra y la detección. `memo:49-50` coloca conteos globales de 62 episodios/138 intentos bajo la columna FT, aunque incluye un MC; FT tiene 29 episodios de una vuelta, no 30.

**Corrección mínima.** Etiquetar suma de subgates y muestra/topología de cada reporte; medir pared de certify separando esperas. No convertir máximos de muestras en upper bounds. «0 atribuibles encontrados» es ausencia de atribución, no tasa causal medida ni muestra de Bernoulli de landings; quitar la regla de tres sobre ese denominador. Las estimaciones 60-80/70-90/>90 % permanecen hipótesis hasta fase 0.

### M18 — MENOR — El alcance anidado y el aviso Stop requieren cambios adicionales concretos

**Escenario.** Se cambia solo el texto Stop y se da por cubierto «todo camino done»: un turno worktree con gate light verde no emite hoy systemMessage; ese canal solo está habilitado para el aviso de main. Con build Claude activo el hook sale antes de la comprobación. Y land MC intenta reconciliar `$MAIN_WT/.pandacorp`, pero la aplicación y su inbox están en `$MAIN_WT/mission-control/.pandacorp`: el paso presupuestado puede omitirse o apuntar al ámbito incorrecto.

**Evidencia.** `F/plugin/scripts/verify-before-stop.sh:26-32,51-65,83-99,188-195,310-318`; `memo:167,171,181-182,217`. `MC/.pandacorp/merge-queue.sh:30-36,292,313-315`: usa project-prefix al copiar sello, pero no al buscar reconciler. `MC/.pandacorp/change-reconcile.mjs:140-148` resuelve inbox desde --project. El hook sigue siendo de iteración y no identifica semánticamente si la respuesta del agente proclama «listo».

**Corrección mínima.** Resolver main-project una sola vez y usarlo para log/reports/reconcile/status; ampliar aviso estructurado a worktrees y conservar excepciones de build explícitas. Usar el mismo check de entorno canónico que M06. Documentar que el aviso es información, mientras que el control determinista de «listo» está en la CLI del motor y en land, no en interpretar la prosa del turno.

## Contraste de cifras (recalculado por lectura/aritmética)

No son nuevas corridas. Leí las evidencias citadas, el JSON de episodios y los tres reportes FT aún presentes; las cifras de logs se verifican como registros de esas fuentes, sin reproducir su ejecución.

| # | Cifra del memo | Contraste y tamaño de muestra | Fuente archivo:línea |
|---|---|---|---|
| 1 | MC 523 s / 8m43s | Correcto: 523,34 s de pared, n=1, rc=0/full verde; no extrapola un techo | `S/out/measure.md:19-21` |
| 2 | MC Playwright 446,7 s / 85 % | 446,67 / 523,34 = 85,35 %, correcto, n=1 | `measure.md:25` |
| 3 | MC Vitest 54,5 s / 10 % | 54,48 / 523,34 = 10,41 %, correcto, n=1 | `measure.md:26` |
| 4 | MC static ≈20 s | 520,32 − 446,67 − 54,48 = 19,17 s; overhead 3,02 s, correcto | `measure.md:27-36` |
| 5 | MC 890 e2e / 3 workers | Correcto como registro de una corrida; 5544 Vitest +2 todo son otra población | `measure.md:38-39` |
| 6 | FT 1407/1459/1499 s, n=3 | Reportes reales full/green: 1407,916; 1459,818; 1499,531 s **sumados**. Dos rutas contienen `wt/…-rescue`; no son tres paredes de land | `S/w-ext/timeline-ext.md:603,617,621`; JSON de esas rutas leído |
| 7 | FT PW mediana 7,8 min, máx 17,3 | 467950/60000=7,799; 1037416/60000=17,290, n=7. Mezcla corridas de distinta finalidad/resultado, no solo verdes finales | `timeline-ext.md:591` |
| 8 | FT Vitest hasta 8,9 min | 533822/60000=8,897, n=16; no máximo futuro de no-bail/related | `timeline-ext.md:590` |
| 9 | PP 3,8 min | Suma 230024 ms=3,834 min, n=1 (13-nov); PW160,631+Vitest58,024+11,369 otros. No medida de pared ni medición actual | `timeline-ext.md:1219-1220,1245`; `measure.md:7-10` |
| 10 | 61/62 episodios FT; 137/138 intentos | Correcto, comprobado en episodes.json; MC n=1, PP n=0 | `S/out/episodes-audit.md:48-50` |
| 11 | FT 43 % primera vez | 26/61=42,62 %, correcto. No confundir con porcentaje de certificaciones verdes | `episodes-audit.md:48` |
| 12 | FT 29 min / p90 272 | partb.out da 29,0/272,4 para **episodios aterrizados**; usa cuantil de índice redondeado (`partb.py:4-7,20-22`), no los 61 sin filtrar | `S/out/partb.out` B1; `episodes-audit.md:48` |
| 13 | Cola 11,5 / p90 21,6 min | Correcto como estimador; comprobé 136 duraciones presentes de 137 intentos FT. `q` omite None: el n efectivo temporal es136 | `S/out/partb.py:4-7,19-22`; `episodes-audit.md:48`; episodes.json |
| 14 | 32 % dentro / 68 % entre | Valores sin redondear publicados: 25,25/79,53=31,75 %; 54,27/79,53=68,24 %, correcto. 25,3+54,3≠79,5 por redondeo | `S/out/partb.out` B2; `episodes-audit.md:54` |
| 15 | Espera dueño med69, máx281; ≤6,4h | 69,2+281,3+30,8=381,3min=6,355h; med69,2. Son intervalos hasta siguiente intento, no medición aislada de esperar al dueño, n=3 | `S/out/partb.py:29-34`; `episodes-audit.md:54` |
| 16 | 30/11/10/11 vueltas; 21/62≈34 % | Total62, 21/62=33,87 %, correcto **global**; FT solo61, una vuelta29 | `episodes-audit.md:69`; episodes.json |
| 17 | 58/60/6/5/4/5 resultados | Suma138, correcto global; uno de los58 aterrizajes es MC | `episodes-audit.md:56-57` |
| 18 | 19 con full; 5/19=26 % | 26,32 %, correcto como detección; el propio análisis pierde full de subagentes y no asegura que fuera el mismo árbol | `episodes-audit.md:10,62-67` |
| 19 | 2 certified frente a28 full | Comprobado en episodes.json: 2 true de certified, 28 true de full_gate; otros108 sin esos marcadores. B6 citado solo acredita los2; no es tasa completa de adopción de sello | `memo:27`; `S/out/episodes-audit.md:71`; episodes.json |
| 20 | Landings certificados 10-44 s | 10,061 y43,536 s, n=2; el13 s de E27.A03 carece de marcador y no es tercero confirmado | `S/out/partb.out` B6; `episodes-audit.md:71`; `memo:64,218` |
| 21 | 81 % clasificación | 13/16=81,25 %, correcto; ≈19 entorno/6-9 flakes son extrapolaciones. «0/60 auditados por main» exagera el alcance | `episodes-audit.md:13-42` |
| 22 | 65 landings/14d≈cada3h activas;13 % | 14×14/65=3,015 h; 24min/180,92min=13,27 % de exposición temporal bajo supuestos uniformes. No es probabilidad medida de stale, menos con ráfagas y fan-out | `memo:158,161`; cálculo sobre sus supuestos |

## Cobertura de carreras y reutilización

- Dos certifies/lands del mismo proyecto: el lock debe compartirse entre worktrees; no colocarlo en run local. M01/M04/M09 cubren pérdida de exclusión, escritores y DB; M10/M12 cubren slots, doble adquisición y cargas fuera del protocolo. Dos lands cooperantes correctamente serializados: el segundo rebasa y debe validar otra vez la identidad final.
- Main avanza con archivos disjuntos: árbol FT/PP distinto → recertificar; no basta rebase limpio. MC solo podría conservar sello si toda entrada funcional estuviera vinculada (M03). Main con solapamiento: full otra vez aunque Git aplique limpio. Conflicto: el script aborta (`merge-queue.sh:202-205`), no deja mágicamente una resolución certificada; resolver/commit/certify nuevamente. Un main divergente posterior hace fallar ff-only si se usa SHA fijo; nombres mutables y escritores fuera de lock abren M04.
- Copia de sello: M07. Reinstalación que cambia metadatos: invalida hoy; parche a node_modules que no los cambia: no. PATH/HOME/navegadores: M06. Ignorado e2e y `.env*`: sí se hashean hoy; generado Prisma/content-collections y archivos externos no enumerados: no. Edición de verify.sh: sí invalida por hash aun ignorado (`green-stamp.sh:28-35,162-165`).
- Lanzado: certify sin orden es viable; ff/push sin orden no lo son. Exit21 actual después del gate y antes de ff; bootstrap del trap dificulta reuso inmediato; después de12h caduca. M05/M16 precisan el flujo que falta.
- Test inestable: rerun con rojo persistente no vuelve verde por sí mismo; exclusión/retry de otra certificación sí puede enmascarar un bug de carrera. M14 exige conservar esa distinción en reportes, sello y política.

## Afirmaciones del memo verificadas como correctas

- G1/Stop son light y G2 es since con smoke+shell; no constituyen full certificador (`RB/report.mjs:166-176`; `RB/next/constants.mjs:27-34`; `MC/.pandacorp/verify.sh:991-996`).
- La cola ya restaura los overrides conocidos y tiene el salto de sello antes del full; un sello válido no necesita puerto libre (`MC/.pandacorp/merge-queue.sh:192-201,226-238`).
- Árbol Git completo, hash de verify, e2e físico, `.env*`, metadatos de dependencias y edad de12h sí forman parte de la validación actual (`green-stamp.sh:65-87,159-167`).
- MC tiene escritores e2e en fixtures y una corrida full verde documentada terminó sin sello; la causalidad específica no fue aislada experimentalmente (`measure.md:40,52-63`).
- FT y PP son tratados como lanzados; MC es interno. El orden actual del control de dueño protege antes de ff/push. El archivo de cola no tiene un logger persistente propio.
- Certificar un SHA final una vez y reutilizar evidencia fuerte puede ahorrar una segunda corrida; los dos aterrizajes certificados documentados muestran que el tramo final puede ser de segundos.

## Veredicto (5 líneas)

No adoptar la propuesta tal como está: hay cuatro bloqueantes de exclusión e identidad.
La certificación anticipada es viable con snapshots inmutables, propiedad de locks y certificado obligatorio antes de ff.
La identidad parcial de MC no ofrece fail-closed mediante sparse; conservar el árbol completo hasta aislar todas las lecturas.
≤2 min es un objetivo condicional, no una cota demostrada; esperas, push y fallback pueden superarlo ampliamente.
Fase0 es razonable tras corregir su oráculo; aprobar fases posteriores solo con los contraejemplos mecánicos cubiertos.
