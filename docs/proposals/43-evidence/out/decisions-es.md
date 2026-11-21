# Decisiones para el dueño — propuesta 43 ("listo" = la cola salió verde)

Memo: `docs/proposals/43-done-means-queue-green.md`. Ninguna opción cambia DR-138: en los proyectos lanzados (funko-tracker, personal-page-v2) cada aterrizaje sigue necesitando tu orden explícita. Esa orden se comprueba antes de avanzar main y antes de publicar, y el gate completo sigue corriendo antes de publicar.

## Resumen (una línea por decisión, por urgencia)

1. **Adoptar el plan**: medir, arreglos baratos y un solo significado de "listo" según el estado de la cola. Recomendada: A.
2. **Pre-push con prueba de gate en proyectos lanzados**: no se publica en producción nada que no haya pasado el gate completo, salvo que lo autorices y quede registrado. Recomendada: A.
3. **Orden de aterrizar por adelantado** en proyectos lanzados: por defecto, revisión primero, o decidir cada vez. Recomendada: C.
4. **Mission Control: pruebas de navegador bloqueantes o en segundo plano.** Recomendada: A.
5. **Tests inestables: qué se puede excluir y quién lo decide.** Recomendada: B.
6. **Presupuestos de tiempo del gate que hagan fallar un cambio.** Recomendada: C.

---

### 1. **Adoptar el plan: medir, arreglos baratos y un solo "listo"**

**Contexto.** Hoy un agente puede decir "listo" después de pasar una prueba más débil que la que exige el merge. El gate completo (todos los tests unitarios y todos los de navegador, sobre la rama ya rebasada encima de main) solo lo corre `merge-queue.sh`, y ahí aparecen los fallos. En funko-tracker, desde el 13 de noviembre, un cambio tarda desde la primera pasada por la cola hasta estar en main una mediana de 25,5 min, con un p90 de 209 min. Si se cuenta desde que la sesión dijo "listo", es una mediana de 29 min y un p90 de 211 min. Una pasada verde de la cola dura una mediana de 17,6 min, y 9 de los 22 cambios necesitaron 3 pasadas o más (todo medido). En 55 de 61 cambios ya habías dado la orden de aterrizar desde el principio (medido), así que para ti "merge" y "gate" son la misma espera: el dolor es la duración del gate por el número de vueltas. El plan tiene tres fases. La fase 0 crea un registro de cada pasada de la cola, que hoy no existe, para tener una línea base. La fase 0.5 trae arreglos baratos: regenerar los tipos de Next.js tras el rebase sin tocar archivos versionados, arreglar el candado (hoy quien se cansa de esperar puede borrar el de otro), que el sello sobreviva a tu espera, y una sola plaza de gate pesado por cola. La fase 1 hace que solo se diga "listo" cuando la cola dio verde ("en main" o "certificado, espera tu orden"), con "implementado, sin certificar" para todo lo anterior, y añade una comprobación de unitarios completa antes de volver a la cola tras un rojo. Aviso honesto: los arreglos de entorno quitan 5 de los 22 rojos recientes, pero esos rojos solo costaron 3 minutos en total (medido). El ahorro de tiempo, si llega, vendrá de menos reparaciones fallidas y de un gate más rápido, y no se puede calcular de antemano; la fase 0 lo medirá. El plan también enmienda reglas vigentes: el protocolo de la cola (DR-096), la receta de lotes (DR-141), el sello (DR-146), y en el gate completo la regla de "si falta una captura visual de referencia, se bendice en vez de fallar". Si no se decide, todo sigue igual.

**Opciones.**
- **A. Las tres fases.** Ganancia: línea base real; ningún "listo" que luego no se pueda mergear; menos vueltas por arreglos que rompen otra cosa; el candado deja de poder perderse. Coste: tras un rojo, una comprobación previa de 1 a 9 min antes de volver a la cola; los agentes dejan de decir "listo" hasta que la cola está verde.
- **B. Solo las fases 0 y 0.5, sin cambiar cómo se nombra "listo".** Ganancia: la medición y los arreglos de candado, sello y entorno con menos cambios en skills. Riesgo: sigue existiendo el "listo" que falla al mergear. Además, el pre-push de la decisión 2 pertenece a la fase 1: si eliges B y también 2 A, hay que adelantar ese pre-push a la fase 0.5.
- **C. Solo la fase 0.** Ganancia: datos sin ningún riesgo. Coste: semanas sin mejora y el candado sigue pudiendo perderse.
- **D. No hacer nada.** Ganancia: ningún trabajo ni cambio de hábitos. Riesgo: siguen los "listo" que no se pueden mergear, el candado que puede perderse y la falta de datos para decidir.

**Recomendada: A.** Ataca la incoherencia que señalaste ("algo terminado que no se puede mergear") sin crear un segundo gate, y corrige defectos reales de la cola. Me haría cambiar de opinión que la fase 0 mostrara que las vueltas se deben casi todas a defectos reales del código: entonces la prioridad pasaría a acelerar el gate (decisión 4 y la fase 2).

---

### 2. **Pre-push con prueba de gate en proyectos lanzados**

**Contexto.** En funko-tracker y personal-page-v2, publicar en main es desplegar en producción. Hoy existe un camino a producción que no pasa por el gate completo: hacer un commit directamente en main y publicarlo con tu permiso. La comprobación previa a publicar (el pre-push) solo mira que el permiso esté puesto, no que el código haya pasado las pruebas. Pasó hoy dos veces en funko: los commits `d98eaccd` y `e1ffcfae` se publicaron sin pasar por la cola (medido en el historial de `origin/main`), y no consta en ningún registro que antes se corriera el gate completo. En 14 días hubo 25 commits directos a main en funko, 2 de ellos arreglos de código (medido). La propuesta es que el pre-push exija una prueba de que el commit exacto que se publica pasó el gate completo. Esa prueba es el registro de la cola que lo acaba de gatear o, si no lo hay, el sello del checkout principal. Si no existe ninguna de las dos, solo se publica con una variable aparte que autorizas tú (`PANDACORP_OWNER_UNGATED_PUSH=1`), y queda anotado con fecha, commit y motivo. Hay algo no verificado todavía: si el sello copiado al checkout principal coincide allí, porque sus dependencias y archivos locales pueden diferir. Por eso la prueba principal es el registro de la cola, y un test de la fase 1 debe confirmarlo antes de activarlo. Esto enmienda la regla del pre-push del motor (DR-153).

**Opciones.**
- **A. Pre-push con prueba de gate obligatoria y bypass explícito registrado.** Ganancia: ningún camino llega a producción con una prueba más débil sin que lo sepas. Coste: un commit directo de documentación o mantenimiento necesita el gate completo en el checkout principal (unos 18 min en funko) o tu bypass.
- **B. Prohibir los commits directos en main de los proyectos lanzados: todo pasa por la cola.** Ganancia: un único camino. Coste: las rutinas automáticas (13 de los 25 commits directos son de memoria o de actualización del overlay) tendrían que usar ramas y la cola, que es más lento y exige cambios.
- **C. Dejarlo como está.** Ganancia: los commits directos siguen siendo inmediatos. Riesgo: un arreglo de código puede llegar a producción sin ninguna prueba completa, como ya pasó hoy.

**Recomendada: A.** Cierra el único camino a producción sin gate con un cambio pequeño y deja una salida rápida y visible para urgencias. Me haría cambiar a B que el registro del bypass mostrara que se usa a menudo.

---

### 3. **Orden de aterrizar por adelantado (proyectos lanzados)**

**Contexto.** En un proyecto lanzado, la cola no publica sin tu orden. Si la das al pedir el cambio ("aterriza cuando esté verde"), la cola prueba y publica en una sola pasada, y main no puede moverse por medio. Si la das después de revisar, la cola se para con el gate verde ("certificado, espera tu orden") y tu paso final cuesta menos de 2 minutos. Las dos veces que esto ocurrió tardó 44 s, y probablemente unos 13 s (medido), pero solo funciona si main no se movió entretanto. Si se movió, el gate completo tiene que correr otra vez: unos 18 min en funko (mediana medida) y unos 4 min en personal-page-v2. Eso no cabe en 2 minutos y el diseño no propone atajos. En funko, main se mueve unas 6 veces al día (91 movimientos en 14 días, medido). Hoy ya das la orden por adelantado en 55 de 61 cambios (medido). La contrapartida de darla siempre es que el cambio llega a producción sin que lo mires, aunque puedes pedir antes una vista previa en una rama. Esta ficha no cambia nada técnico: fija la práctica por defecto.

**Opciones.**
- **A. Por adelantado por defecto: el agente te pregunta al empezar si autorizas aterrizar cuando la cola esté verde.** Ganancia: sin ventana en la que main se mueva y sin segundo gate. Riesgo: el cambio llega a producción sin que lo mires.
- **B. Revisión primero por defecto: siempre se para en "certificado, espera tu orden".** Ganancia: miras antes de publicar. Coste: si main se movió mientras tanto, otro gate completo.
- **C. Sin regla por defecto: decides en cada cambio, como hoy, y el agente te dice lo que cuesta cada opción.** Ganancia: flexibilidad según el riesgo de cada cambio. Coste: ninguno nuevo.

**Recomendada: C.** Ya das la orden por adelantado casi siempre, y lo que conviene depende del riesgo de cada cambio. El plan hace que esperar tu orden salga barato cuando main no se movió y que el coste quede a la vista cuando sí. Me haría cambiar a A que el registro mostrara que las esperas de orden suelen acabar en un segundo gate.

---

### 4. **Mission Control: pruebas de navegador bloqueantes o en segundo plano**

**Contexto.** Mission Control es interno (no tiene producción), y la app que usas es una copia desplegada aparte que no cambia hasta que se redespliega. Su gate completo dura 8,7 min (medido, una corrida). El 85 % son las pruebas de navegador (comportamiento, visual, móvil); lo estático más los tests unitarios suman unos 74 s (medido). Pediste considerar sacar el navegador del camino bloqueante en proyectos no lanzados. Si se hace, el merge de MC bajaría a unos 75 s más el rebase. El navegador correría después en un worktree propio y desechable con el estado de main, unos 7,5 min. Si sale rojo: aviso en el escritorio, una marca de "main roto" que bloquea los demás aterrizajes de MC y el redespliegue de la copia, y una reversión por la cola. El riesgo es que una regresión visual o de comportamiento esté en main unos 7,5 min y que otras sesiones vean fallar sus pruebas por algo que no hicieron, porque MC comparte main con toda la fábrica. La alternativa es mantener el navegador bloqueante y hacerlo más rápido. 425 de sus 890 pruebas corren hoy de una en una porque comparten datos de prueba; dando a cada proceso su propia copia, el gate bajaría a unos 5,5-6,5 min (proyectado). En los registros de 20 días, MC solo pasó una vez por la cola.

**Opciones.**
- **A. Navegador bloqueante y acelerarlo con copias de datos por proceso.** Ganancia: main de MC nunca recibe una regresión visual; el gate baja de 8,7 a unos 6 min. Coste: trabajo en las pruebas de MC; el merge sigue siendo un gate de unos 6 min.
- **B. Navegador en segundo plano sobre main, en un worktree desechable, con aviso, bloqueo y reversión.** Ganancia: el merge de MC baja a unos 75-90 s. Riesgo: regresiones en main durante unos 7,5 min, y fallos que otras sesiones ven sin haberlos causado. Regla de corte: si en sus primeros 20 aterrizajes una regresión rompe main, se vuelve a A.
- **C. No hacer nada: el gate sigue en 8,7 min, todo bloqueante.** Ganancia: ningún trabajo ni riesgo nuevo. Coste: cada merge de MC sigue costando 8,7 min y el gate seguirá creciendo con cada pantalla nueva.

**Recomendada: A.** La fidelidad visual de Mission Control te ha importado repetidamente. Los datos no muestran que su merge sea hoy un cuello de botella (una sola pasada por la cola en 20 días), y main es compartido con toda la fábrica. Me haría cambiar a B que el registro mostrara aterrizajes de MC frecuentes con esperas largas, o que la aceleración no bajara el gate de unos 6,5 min.

---

### 5. **Tests inestables: qué se puede excluir y quién lo decide**

**Contexto.** Un test inestable es el que pasa y falla sobre el mismo código. Hoy no hay reintentos ni exclusiones, así que cada fallo inestable cuesta una vuelta completa del gate. En funko fueron entre 6 y 9 de 60 rojos (estimado sobre una muestra auditada de 16). El plan incluye en todos los casos un registro visible de sospechosos: cada pasada de la cola anota el resultado de cada test con su código, orden y proceso, y un test que pasa y falla sobre el mismo código aparece como sospechoso en Mission Control. Nada se vuelve verde por repetir, y ningún agente puede excluir un test. La decisión es si puedes autorizar tú exclusiones temporales. Cada exclusión sería de un test exacto, con motivo y una caducidad de como mucho 14 días. El sello de certificado caducaría con ella, y los tests excluidos seguirían corriendo cada noche en un worktree desechable sobre main, con su resultado anotado. Ese gate nocturno forma parte de esta opción y no depende de la decisión 4.

**Opciones.**
- **A. Solo registro, sin exclusiones en ningún proyecto.** Ganancia: el gate nunca se debilita. Coste: cada inestable cuesta una vuelta hasta que alguien lo arregla.
- **B. Registro, más exclusiones autorizadas por ti una a una, con caducidad de 14 días y gate nocturno, solo en proyectos internos (Mission Control); en lanzados, ninguna.** Ganancia: un inestable deja de bloquear MC mientras se arregla. Riesgo: un defecto real escondido en un test excluido de MC hasta 14 días (el nocturno lo vería).
- **C. Como B, pero también en proyectos lanzados, siempre autorizadas por ti una a una.** Ganancia: alivia funko, que es donde hay más vueltas. Riesgo: un defecto real puede llegar a producción mientras el test está excluido.

**Recomendada: B.** Mantiene intacta la protección de producción y deja una válvula controlada donde un fallo no llega a usuarios. Me haría cambiar a C que el registro mostrara en funko pocos inestables, muy repetidos y claramente ajenos al producto (por ejemplo, solo tiempos agotados bajo carga en tests de herramientas).

---

### 6. **Presupuestos de tiempo del gate que hagan fallar un cambio**

**Contexto.** Pediste que las pruebas sean rápidas. Hoy existe un mecanismo de presupuesto por etapa del gate que solo avisa y que ningún proyecto tiene configurado, así que nunca salta. Las suites crecen con cada funcionalidad: Mission Control tiene 890 pruebas de navegador, y una pasada verde de la cola en funko dura unos 18 min (mediana medida). Un presupuesto que haga fallar el cambio frena ese crecimiento, pero el tiempo de reloj depende mucho de la carga de la máquina, y con carga una etapa verde puede ir lenta. Si eso la hace fallar, se suma una vuelta sin que haya defecto. La alternativa es medir lo que añade cada cambio: el tiempo propio de los tests nuevos, sacado del informe del gate. Ese tiempo depende menos de la carga y apunta a la causa del crecimiento. Las cifras de referencia saldrían del registro de la fase 0.

**Opciones.**
- **A. Seguir solo con avisos, configurando por fin la línea base.** Ganancia: cero vueltas extra. Coste: el gate puede seguir creciendo sin freno.
- **B. Fallar cuando una etapa supere su línea base en más de un margen (por ejemplo, un 50 %).** Ganancia: freno fuerte. Riesgo: vueltas falsas en horas de carga.
- **C. Fallar cuando los tests que añade un cambio sumen más de un tope propio (por ejemplo, 30 s de navegador o 10 s de unitarios), con línea base y avisos generales como en A.** Ganancia: frena el crecimiento en el momento en que se produce y dice qué tests lo causan. Riesgo: un cambio grande y legítimo necesita que subas su tope de forma explícita.

**Recomendada: C.** Ataca la causa (tests nuevos y lentos) sin castigar la carga de la máquina, que ya provoca rojos por tiempo agotado. Me haría cambiar a B que el registro mostrara que el gate crece sobre todo porque los tests existentes se vuelven más lentos, y no por los nuevos.

## Decisiones tomadas (2026-11-20)

El dueño delegó las decisiones con este criterio: "lo más fácil y lo más rápido posible, sin afectar que las cosas sean confiables y bien hechas".

| # | Decisión | Opción elegida | Motivo (una línea) |
|---|---|---|---|
| 1 | Adoptar el plan | **A**: todas las fases (0 medición, 0.5 arreglos baratos, 1 "listo" único), luego fase 2 de gate más rápido | Empieza barato, mide primero y cada fase es reversible |
| 2 | Pre-push con prueba de gate en proyectos lanzados | **A**: obligatoria, con bypass explícito del dueño registrado | Cierra el único camino a producción sin gate completo a casi coste cero |
| 3 | Orden de aterrizar en proyectos lanzados | **A**: por adelantado por defecto | Ya ocurre en 55 de 61 casos; lo más rápido y sin flujo nuevo |
| 4 | Mission Control, pruebas de navegador | **A**: siguen bloqueantes y se aceleran con datos de prueba por proceso | Mantiene la fiabilidad; la velocidad llega por la fase 2 |
| 5 | Tests inestables | **B**: registro visible; exclusiones autorizadas por el dueño una a una, caducidad de 14 días y corrida nocturna, solo en Mission Control; ninguna en proyectos lanzados | Reduce el ruido sin esconder defectos donde hay producción |
| 6 | Presupuestos de tiempo | **C**: falla cuando los tests que añade un cambio superan un tope propio; línea base y avisos generales | Ataca la causa (tests nuevos lentos) sin castigar la carga de la máquina |

Nota sobre la decisión 3: el memo recomendaba C; se eligió A por el criterio de rapidez y porque ya ocurre en 55 de 61 casos. El agente pregunta al empezar si autoriza aterrizar cuando la cola esté verde; el gate completo sigue corriendo antes de publicar; DR-138 no cambia (una orden explícita del dueño por aterrizaje, solo pedida al inicio).
