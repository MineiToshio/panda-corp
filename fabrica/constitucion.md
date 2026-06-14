# Constitución de Pandacorp

Principios innegociables de la fábrica. Todo agente, skill y proyecto los cumple. Cambiarlos requiere decisión explícita de Sergio.

## Misión

Construir un portfolio de aplicaciones con IA al 100%: (1) apps que generen ingresos —muchas pequeñas suman— y (2) apps que faciliten la vida de Sergio, monetizables o no.

## Principios de proceso

1. **Spec antes que código.** Nada se implementa sin PRD/FRD con criterios de aceptación verificables (formato EARS cuando aplique). La spec es la fuente de verdad.
2. **Artefactos antes que chat.** Cada fase produce documentos versionados en el repo del proyecto. Las decisiones viven en archivos, no en conversaciones.
3. **Verificación determinista y adversarial.** El modelo propone; scripts/CI/hooks verifican. Un agente jamás declara "terminado" por auto-reporte: tests verdes, lint limpio, criterios cumplidos. Los gates son **fail-closed** (cualquier ambigüedad o salida sin parsear = fallo, nunca "pasa por defecto") y corren en entorno limpio. La verificación de un trabajo la hace **otro agente** (el `reviewer`, idealmente de modelo distinto al que generó el código), que **re-ejecuta** la evidencia y escribe **tests adversariales que el implementador no vio** — porque los errores de un mismo modelo se agrupan y sus tests heredan sus puntos ciegos (evidencia: ver `docs/propuestas/06-plan-de-mejoras-2026.md`).
4. **TDD por work order.** Tests de aceptación primero (RED), implementación mínima (GREEN), refactor después. Máximo 3 intentos de reparación por subtarea; luego se escala. Los tests se **anclan en fuentes humanas** —los criterios EARS de los FRDs y los bugs reales registrados en `docs/progreso.md`—, no en lo que el modelo imagina. En cada hito de FRD se corre **mutation testing** (y property-based donde aplique) para cazar tests decorativos. Cada work order es un **chunk pequeño, testeable en aislamiento**; el `reviewer` rechaza work orders demasiado grandes.
5. **Diseño antes de implementación.** Mockups navegables aprobados por Sergio antes de escribir código de producto. La implementación solo usa design tokens, nunca valores hardcodeados.
6. **Decisiones humanas mínimas y explícitas.** Solo: selección de ideas, elección de diseño, release a producción, gastar dinero, comunicaciones externas, borrado de datos, cambios de accesos. Todo lo demás: registro de decisiones (`fabrica/decisiones/registro.yaml`). Decisión no cubierta → escalar UNA vez → codificar la respuesta como regla. Estos gates se aplican como **reglas `deny` duras** en `.claude/settings.json` + hooks deterministas, **nunca** como límites dichos en la conversación (la compactación de contexto puede perderlos); el "auto mode" no es blindaje.
7. **Cada intervención humana debe reducir las futuras.**

## Principios técnicos

8. **Estándares y stack.** Las **convenciones duraderas** (estructura, calidad, patrones, testing) son obligatorias e iguales en todo proyecto: ver `fabrica/estandares/`. El **stack es una sugerencia por defecto** (`fabrica/estandares/stack.md`, siempre en últimas versiones estables): el `architect` lo propone en el blueprint, puede sugerir mejores tecnologías si encajan, y **Sergio lo aprueba** ahí (gate humano ligero, registrado como ADR).
9. **Tipado estricto y calidad.** Tipado estricto en el lenguaje elegido (TS strict / mypy --strict), linter+formatter del stack, cero errores/warnings nuevos. Detalle en `fabrica/estandares/calidad.md`.
10. **Scaffold determinista.** Los proyectos nacen de plantillas/scaffolders oficiales + overlay Pandacorp, nunca improvisados.
11. **Git disciplinado.** Conventional Commits con scope, en inglés. Feature branches; nunca push directo a main; nunca force push. CI verde para mergear.
12. **Seguridad.** Secretos jamás en código ni en contexto de agentes (inyección por entorno). Dependencias con lockfile, sin CVEs conocidos, mantenidas en los últimos 12 meses. Nunca auth casero: Better Auth / Supabase Auth. La auditoría agéntica sigue el **OWASP Top 10 for Agentic Applications** (ASI01–ASI10, dic-2025): cuando los agentes tienen acceso a Bash, memoria entre work orders y delegación, son riesgos de primera clase **Tool Misuse**, **Identity & Privilege Abuse**, **Memory Poisoning** (envenenar `docs/progreso.md` o el contexto compartido) y **Cascading Failures**.
13. **Trazabilidad.** Decisiones arquitectónicas → ADR en `docs/adr/` del proyecto (incluye qué agente/modelo decidió y el trade-off aceptado).
14. **Implementación multi-agente.** La fase de implementación usa Agent Teams: agentes especializados (backend, frontend, testing) que se comunican entre sí y se pasan el trabajo con dependencias, no agentes sueltos secuenciales. Diseñar para Max 5x en proyectos (ver DR-013, DR-014): equipos de ≤3 agentes, líder en opus, obreros en sonnet/haiku. La construcción de la propia fábrica puede usar equipos mayores mientras el plan lo permita. Agent Teams es experimental: escribir el contexto crítico entre agentes a archivos, no solo a mensajes.

## Principios de producto

15. **Idioma**: documentos en español; código, commits, identificadores y nombres técnicos en inglés.
16. **UX/UI reforzado.** Sergio es débil en diseño: cada proyecto investiga referencias visuales, usa shadcn/ui + design tokens, genera 3 direcciones de diseño y verifica accesibilidad (axe-core) automáticamente antes del gate humano.
17. **Releases pequeños.** v1 = el corte mínimo que valida la hipótesis de valor. Iterar con `/pandacorp:new-version`.
18. **Testing por hito.** Cada FRD/work order cerrado se prueba al cerrarse, no al final. E2E solo en flujos críticos con `data-testid`.

## Separación fábrica/proyecto

19. La fábrica define el CÓMO (proceso, estándares, plantillas) y mantiene punteros (portfolio). Todo artefacto de producto vive en el repo del proyecto. El proyecto nunca necesita leer la fábrica para trabajar (el know-how llega vía plugin).

## Principios reforzados (2026)

> Derivados de la investigación en `docs/propuestas/06-plan-de-mejoras-2026.md`.

20. **Documentación viva.** La documentación se genera y mantiene sola: changelog desde Conventional Commits, ADRs propuestos automáticamente cuando se detecta un cambio arquitectónico, README/docs de usuario actualizados como parte del work order, no como tarea aparte. Doc desincronizada del código = defecto.
21. **Trazabilidad de fallos.** Cada hook y cada gate existe para prevenir un **modo de fallo conocido** (taxonomía MAST: diseño de sistema, desalineación inter-agente, verificación/terminación de tarea). El gate `Stop`/`verify.sh` previene la *terminación prematura* y la *verificación incompleta/incorrecta*. Cada agente lleva un **SOP de verificación intermedia** (qué confirma antes de pasar el trabajo), no solo el skill orquestador.
22. **No confiar en la honestidad del modelo.** La propensión de un modelo a "hacer trampa" depende de su entrenamiento; nunca se asume que un obrero es honesto. Por eso toda evidencia se **re-verifica** de forma independiente y el entorno de evaluación se **endurece** (fail-closed, fixtures no expuestos, nombres de tests no revelados al generador).
23. **Construcción desatendida sobre puntos seguros.** `implement` corre por horas sin babysitting (auto mode + freeze-on-red + circuit breakers). El **punto seguro es un commit de git**, no un estado del agente: cada work order cierra en verde y se commitea, y el operador prueba ese snapshot en un **git worktree** aparte sin parar la construcción. El operador le habla a una construcción en curso por **archivos** (bandejas `docs/bugs/`, `docs/decisiones.md`, y la señal `replanteo_pendiente`), que el agente revisa en cada punto seguro — nunca a media obra. Detalle: `fabrica/estandares/infra.md` y `docs/propuestas/07-construccion-desatendida.md`.
