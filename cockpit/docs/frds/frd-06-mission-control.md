# FRD-06 — Mission Control (mapa RPG en vivo)

Vista tipo RPG del equipo de agentes construyendo un proyecto: zonas pixel-art y personajes que se mueven y se comunican.

## Criterios de aceptación (EARS)
- LA vista DEBERÁ mostrar 4 **zonas con arte pixel-art** (Investigación = biblioteca, Backend = forja, Frontend = taller, Testing = laboratorio), cada una con su etiqueta.
- CADA agente del equipo (investigador, backend, frontend, testing) DEBERÁ aparecer como un **sprite** (su avatar) ubicado en su zona.
- MIENTRAS no haya comunicación, los sprites DEBERÁN tener vida: una animación de "respiración" continua y **deambular** por toda su zona (no quedarse quietos).
- CUANDO dos agentes se comunican, el visitante DEBERÁ moverse a la zona del otro y **ambos DEBERÁN quedar juntos** (el anfitrión se hace a un lado), con una **burbuja de diálogo**.
- EL investigador es **a demanda**: backend y frontend lo consultan cuando lo necesitan (no es un paso fijo al inicio).
- LA vista DEBERÁ mostrar una **bitácora** de los mensajes entre agentes.
- CUANDO se cierra un work order, DEBERÁ dispararse un **logro** ("¡Logro desbloqueado!").
- LA vista DEBERÁ alimentarse de los eventos de los hooks de la fábrica (`~/.claude/dashboard-events.ndjson`) y del estado de tareas (`~/.claude/tasks/`), **sin llamar a Claude**. En el prototipo se **simula** con un botón.
- LA vista es de **observación**: para redirigir/pausar un agente, Sergio usa la app de Claude Code.
- SI no hay equipo activo, DEBERÁ mostrar un estado vacío con gracia.

## Futuro
El equipo mostrado escalará según el **modo de construcción** ([FRD-11](frd-11-modos-de-construccion.md)): más o menos agentes, e incluso varios del mismo rol, posicionados dentro de sus zonas.
