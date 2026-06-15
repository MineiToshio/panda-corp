# PRD — Pandacorp (el panel de la fábrica)

## Visión
Una sola pantalla para operar la fábrica Pandacorp **como si fuera un RPG**: ver el estado de todas las ideas y proyectos, leer su documentación, saber qué comando ejecutar, y seguir en vivo al "party" de agentes construyendo — todo envuelto en una capa de gamificación honesta que hace divertido el trabajo real.

## Problema
Operar la fábrica solo desde la terminal es árido: no hay vista del estado general, hay que abrir archivos a mano, no es obvio qué skill toca, y nada sostiene la motivación del operador solo en el día a día.

## Usuario
El dueño (operador único, hispanohablante). Débil en UX → la herramienta debe **guiar y deleitar**, no solo mostrar datos.

## Hipótesis de valor
Una vista de solo-lectura que muestre estado + documentación + el siguiente comando, envuelta en una capa RPG **honesta** (XP, niveles y logros que reflejan trabajo real), reduce la fricción y hace placentero operar la fábrica a diario — **sin gastar la suscripción** (nunca llama a Claude) y **sin caer en gamificación tóxica**.

## Principios y restricciones
- **Solo-lectura**: nunca llama a Claude ni ejecuta nada. Única escritura: marcar una idea como `descartada`.
- **Lee archivos**: base de ideas y portfolio en la fábrica; documentación y estado de cada proyecto en su carpeta.
- **Local**: escucha en `127.0.0.1`. Sin auth, sin deploy.
- **Gamificación honesta**: representa trabajo real (XP por resultado, no por volumen ni por abrir la app). Nada de leaderboards, vidas/muerte, rachas diarias ni urgencia falsa (ver [FRD-09](frds/frd-09-gamification.md)).

## Qué queremos lograr (objetivos de producto)
1. Ver de un vistazo el estado de toda la fábrica (ideas, proyectos, agentes).
2. Leer cualquier documento sin abrir archivos a mano.
3. Saber siempre el siguiente comando, y poder elegir el **modo de construcción** por proyecto.
4. Seguir en vivo a los agentes construyendo, de forma divertida (**Party** tipo RPG).
5. Sentir progreso: **logros**, **stats** que crecen, **nivel del gremio** y **niveles de los agentes**.
6. Que otra persona pueda entender todo el sistema (documentación interna).

## Scope v1
Cinco pestañas — **Tablero, Portfolio, Logros, Configuración, Documentación** — + el **workspace por proyecto** + **Party RPG** + **gamificación** (logros/stats/XP/niveles) + **modos de construcción** + **snapshot probable y canales de feedback** ([FRD-14](frds/frd-14-snapshot-and-feedback.md): panel de "último punto probable / construyendo ahora" con comando de worktree, chips de decisiones/bugs por proyecto), según los FRDs (`docs/frds/`, FRD-01 a FRD-14). El prototipo navegable (`mission-control/prototype/index.html`) es el diseño aprobado. Transversal a todas las pestañas: **observabilidad y data-viz** ([FRD-12](frds/frd-12-observability-dataviz.md): KPIs, frescura del dato, toggle RPG↔timeline, DAG) y el **sistema visual y de accesibilidad** ([FRD-13](frds/frd-13-visual-system-accessibility.md): tokens OKLCH, acento racionado, `tabular-nums`, motion sobrio, `prefers-reduced-motion`, estado por icono+color).

## No-objetivos (v1)
- No ejecuta comandos ni agentes (el dueño los pega en Claude Code).
- No es multiusuario ni se despliega a internet. Sin leaderboards.
- No edita la documentación de los proyectos.

## Métricas de éxito
- Ver el estado de cada idea/proyecto y obtener el comando del siguiente paso, sin abrir archivos.
- Cero llamadas a Claude desde Pandacorp.
- El operador vuelve a diario: la gamificación sostiene el hábito sin fatiga.

## Backlog (futuro)
- Cálculo real de stats/logros leyendo la fábrica y los proyectos (hoy datos de ejemplo en el prototipo).
- Party dinámico por modo (más/menos agentes, varios del mismo rol).
- Momento full-screen al subir de nivel; transiciones de fase como "cutscene"; racha semanal; meta-logros (Sellos con título); gráfico de actividad por agente.
- Auto-refresh robusto (file-watching) + streaming real de eventos.
