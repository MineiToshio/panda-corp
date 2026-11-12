---
title: "La Fragua"
group: concepts
order: 19
---

# La Fragua: el build en vivo

La Fragua, en Resumen del proyecto, muestra las estaciones Cola, Taller, Revisión y Bóveda.
Los tokens representan órdenes reales; la decoración no cuenta agentes ni mediciones.

## Trabajo en curso y trabajo entregado

El frontmatter conserva el estado duradero. Durante un run activo y coincidente, las unidades
de build y patch aportan una capa marcada **En el build** para sus órdenes. Las revisiones y
consultas no crean órdenes adicionales. Los contadores, barras y estaciones usan el mismo modelo.

Trabajo admitido o ejecutándose pasa a Taller; reportado, integrado o verificado en rama queda
en Revisión hasta llegar a main. Lo planificado o en parche vuelve a Cola; lo bloqueado conserva
su aviso. Una pregunta aparcada o un gate conserva la columna duradera con su motivo.
Una unidad landed permite mostrar lo verificado en Bóveda. Verificar una rama no demuestra
que el snapshot de main sea seguro para probar.

## Señal de vida

Una lease válida, renovada y coincidente con un run activo permite mostrar actividad. Una bandera
running en main no basta: puede quedar atrás durante el build. La lease se renueva con comandos,
tiene un plazo de 30 minutos y no depende de un proceso heartbeat separado. Tras perder la señal,
la vista indica **Sin señal**; un coordinador caído puede parecer vivo hasta vencer la lease.
Los eventos son observaciones, nunca autoridad para revivir un run terminado.

## Recursos y preguntas

Build en curso muestra unidades por estado, agentes activos, escalón y motivo de concurrencia,
espera por disco, preguntas y gates. El escalón es un techo, no el número de agentes activos.
La escalera 1/2/3/5/8 empieza en 5 sin historial, baja con presión y se recupera con estabilidad;
8 requiere evidencia previa. La presión crítica baja a 1, no a 0. Esperar disco impide nuevas
asignaciones sin detener lo que ya trabaja.

El historial de rendimiento procede del registro local `~/.pandacorp/host/perf/journal.jsonl`.
Resume RAM disponible, swap, agentes y tiempos por run; puede faltar en un run aún abierto.
**Sin datos** no significa cero. El dashboard lee esos datos y no calibra ni ejecuta el motor.
Los cambios en state.json, admission.json y las preguntas refrescan la vista aunque no haya
eventos nuevos. Un archivo presente pero malformado muestra su error, nunca un éxito vacío.
