# PRD — Pandacorp (cockpit de la fábrica)

## Visión
Una sola pantalla para operar la fábrica: ver el estado de todas las ideas y proyectos, leer su documentación, y saber qué comando ejecutar a continuación. Es la interfaz de la propia fábrica Pandacorp.

## Problema
Operar la fábrica solo desde la terminal es incómodo: no hay vista del estado general, hay que abrir archivos a mano para leer la documentación, y no es obvio qué skill toca en cada momento.

## Usuario
Sergio (operador único). Débil en UX — la herramienta debe guiarlo, no solo mostrar datos.

## Hipótesis de valor
Una vista de solo-lectura que muestre estado + documentación + el siguiente comando reduce la fricción de operar la fábrica, **sin gastar la suscripción** (el cockpit nunca llama a Claude).

## Principios y restricciones
- **Solo-lectura**: nunca llama a Claude ni ejecuta nada. Única escritura permitida: marcar una idea como `descartada`.
- **Lee archivos**: la base de ideas y el portfolio en la fábrica (`panda-corp/fabrica/`); la documentación y el `estado.yaml` de cada proyecto en su carpeta.
- **Local**: escucha en `127.0.0.1`. Sin auth, sin deploy.
- Vive dentro de la fábrica (`panda-corp/cockpit/`) como su interfaz.

## No-objetivos (v1)
- No ejecuta comandos ni agentes (Sergio los copia y pega en Claude Code).
- No es multiusuario ni se despliega a internet.
- No edita la documentación de los proyectos.

## Métricas de éxito
- Sergio puede ver, sin abrir archivos a mano, el estado de cada idea/proyecto y obtener el comando del siguiente paso.
- Cero llamadas a Claude desde el cockpit.

## Scope v1
Cuatro pestañas — **Tablero, Portfolio, Configuración, Documentación** — y el **workspace por proyecto**, según los FRDs (`docs/frds/`). El prototipo navegable (`cockpit/prototype/index.html`) es el diseño de referencia aprobado.

## Backlog (futuro)
- Auto-refresh robusto (file-watching) y streaming real de Mission Control desde `~/.claude/dashboard-events.ndjson`.
- Búsqueda/filtro de ideas.
- Avatares pixelart reales de los agentes (estilo Final Fantasy).
- Mostrar costos de infraestructura de proyectos lanzados.
