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
la reanudación requiere otra lectura. La reanudación automática corresponde a la fase 3.

Las preguntas iniciales incluyen sus valores por defecto. Una duda posterior se consulta;
si no puede resolverse dentro del alcance autorizado, la unidad y sus dependientes se aparcan
y el resto continúa. Las decisiones pendientes se responden por el canal de decide, no editando
el estado del motor. Cuando el inbox está versionado, `decisions.pending.md` permite leer las
preguntas antes de integrar.

## Verificado en rama e integrado

Los cambios versionados del run se escriben en `lane/<run_id>/integration`, nunca en la copia
principal. Merge-queue es el único camino a main. Una unidad verificada en una rama aún no
significa trabajo entregado ni un snapshot seguro para probar. En un proyecto lanzado,
`waiting_gate` conserva la espera de la orden explícita del propietario para producción.
