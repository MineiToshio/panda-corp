# FRD-06 — Mission Control

Vista en vivo del equipo de agentes construyendo un proyecto.

## Criterios de aceptación (EARS)
- LA Mission Control DEBERÁ mostrar los agentes del equipo (backend, frontend, testing, e investigador) con su **estado** (en cola / trabajando / esperando / terminado) y los **mensajes** que se cruzan entre ellos.
- EL backend y el frontend DEBERÁN poder **consultar al investigador a demanda** (representado como tal, no como un paso fijo al inicio).
- LA vista DEBERÁ mostrar la comunicación en **ambos sentidos** (p. ej. backend↔frontend) y, CUANDO testing detecta un bug, el **retorno** al agente correspondiente.
- LA Mission Control DEBERÁ alimentarse de los eventos que los hooks de la fábrica escriben en `~/.claude/dashboard-events.ndjson` y del estado de tareas en `~/.claude/tasks/`, **sin llamar a Claude**.
- SI no hay un equipo activo, ENTONCES EL sistema DEBERÁ mostrar un estado vacío.
- LA vista es de **observación**: para redirigir o pausar un agente, Sergio usa la app de Claude Code (se indica en la UI).

## Nota
En el prototipo, Mission Control se **simula** con un botón; la versión real lee el NDJSON de eventos en (casi) tiempo real.
