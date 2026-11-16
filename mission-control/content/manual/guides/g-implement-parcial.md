---
title: "Construir un FRD o una tarjeta"
group: guides
order: 4
---

# Construir un FRD o una tarjeta

`/pandacorp:implement` es la entrada para construir funciones, ajustes y bugs. Claude Code
y Codex coordinan el mismo CLI; el motor fija el alcance antes de ejecutar y no incorpora
otras tarjetas de la cola.

## Elegir el alcance

| Intención | Comando |
|---|---|
| Construir el plan pendiente o detectar el contexto conversado | `/pandacorp:implement` |
| Retomar el run existente | `/pandacorp:implement --resume` |
| Construir el trabajo pendiente de un FRD | `/pandacorp:implement FRD-04` |
| Construir una tarjeta concreta | `/pandacorp:implement change:mi-cambio` |

Un objetivo de FRD selecciona su trabajo pendiente, no una orden individual. Desde una
orden, usa su FRD. La sesión comprueba alcance, documentación y dependencias antes de
construir. Si describes un cambio, el comportamiento acordado queda en una tarjeta citada.
El run dirigido no amplía su alcance hacia otras tarjetas ni hacia el cierre global.

## Anotar sin construir

Di «anótalo» para guardar un borrador en `.pandacorp/inbox/changes/`. La sesión lo valida con
`node <plugin>/scripts/pandacorp-build.mjs card check <path>` y termina sin lanzar un build.
Una tarjeta incompleta necesita preparación; una tarjeta sospechosa de estar ya hecha necesita
reconciliación. Una tarjeta en construcción retoma su run; una cerrada no es trabajo pendiente.
`change:<id>` referencia un archivo, no otro comando de construcción.

## Qué ocurre durante el run

El CLI planifica y admite unidades con el asignador de capacidad compartida. Una revisión en
un contexto independiente, incluso con el mismo modelo, y los gates comprueban el contrato completo, con trazabilidad de requisitos a
pruebas y evidencia adversarial en los límites. Pasar criterios numerados no permite omitir
otras cláusulas normativas. Un gate rojo repara solo el alcance atribuido al fallo. Solo las
ejecuciones de build y patch gastan el presupuesto de tres intentos por unidad.

El cupo se comparte por cuenta. Si una herramienta no tiene margen, la siguiente unidad pasa a la otra;
una unidad en curso conserva su herramienta. Solo si ninguna puede trabajar, el run se aparca con
`resumeAt`. El lead actualiza `get_usage` antes de cada ola y no pregunta al propietario por cupos.
La selección fija respeta el piso de riesgo y las reservas: si deja de caber, espera solo esa tarea,
sin cambiarla de herramienta en curso. Un reset vencido queda pendiente de confirmar y no borra otros
límites vigentes. `resumeAt` indica cuándo podría caber alguna celda apta tras todos sus resets bloqueantes;
la reanudación requiere otra lectura. El despertar automático conserva el trabajo y su herramienta.
Si el lanzador se interrumpe al reanudar, la recuperación conserva también los límites de tiempo
de esa ejecución, para que un proceso colgado no siga indefinidamente.

Las preguntas iniciales incluyen sus valores por defecto. Una duda posterior se consulta;
las decisiones técnicas reversibles quedan documentadas y permiten continuar. Las decisiones
de alcance o irreversibles conservan sus gates: se aparca solo el trabajo afectado y sus
dependientes, mientras el resto continúa. Las decisiones pendientes se responden por el canal de decide, no editando
el estado del motor. Cuando el inbox está versionado, `decisions.pending.md` permite leer las
preguntas antes de integrar.

Si una unidad queda bloqueada porque necesita archivos fuera de su allowlist, el coordinador registra tu aprobación
de archivos concretos con `scope-repair --epoch E --unit U --files '<JSON>' --owner-approved --reason '<decisión>'`.
Si el run se detuvo, primero lo retoma con `start --resume`. Un architect recibe una unidad de documentación acotada
para ampliar `artifacts` de esa orden bloqueada; tras verificar e integrar la reparación, el motor continúa el mismo
intento, conservando la rama y los cambios locales. Los tests protegidos siguen el camino de disputa existente y no
entran por una ampliación del allowlist. La decisión, la reparación y la reanudación quedan en el journal.

## Verificado en rama e integrado

Los cambios versionados del run se escriben en `lane/<run_id>/integration`, nunca en la copia
principal. Merge-queue es el único camino a main. Una unidad verificada en una rama aún no
significa trabajo entregado ni un snapshot seguro para probar. En un proyecto lanzado,
`waiting_gate` conserva la espera de la orden explícita del propietario para producción.

El esfuerzo del implementador sigue la complejidad de cada work order: trivial, normal o compleja.
Hello World es trivial; un formulario con validación, normal; una ingesta de imágenes o integración externa, compleja.
Trivial usa Sol low o Sonnet medium; normal, Sol medium o Sonnet high; compleja, Sol high u Opus medium.
Si una unidad de UI en cola pierde su fuente visual, el diseño reparador conserva el mayor riesgo
y complejidad de la unidad y sus órdenes de trabajo. Una reparación antigua aún en cola se eleva
antes de asignarse; una ejecución activa conserva su selección y no sustituye una reparación
que exige un piso superior. El trabajo independiente sigue avanzando.

El riesgo crítico impone Astra high u Opus high. Los mínimos de revisión son Sol medium u Opus low,
siempre por encima del autor también entre herramientas. El riesgo puede subir el mínimo. El revisor usa un escalón superior a la celda real del implementador y un contexto
independiente. Si ninguna herramienta admite la celda completa, se permite bajar una vez el esfuerzo en tareas
normales o complejas, respetando los mínimos de riesgo y revisión; después se espera al cupo.

La revisión debe superar al autor también al cambiar de herramienta: Astra high y Opus high son equivalentes,
y requieren un revisor xhigh. Si una revisión antigua suspendida no cumple ese mínimo, vuelve a la cola
con un contexto nuevo conservando sus archivos. El resultado sólo se acepta si su celda y esfuerzo cumplen
la regla; un contexto independiente por sí solo no permite repetir la celda del autor.
