# Constitución de Pandacorp

Principios innegociables de la fábrica. Todo agente, skill y proyecto los cumple. Cambiarlos requiere decisión explícita de Sergio.

## Misión

Construir un portfolio de aplicaciones con IA al 100%: (1) apps que generen ingresos —muchas pequeñas suman— y (2) apps que faciliten la vida de Sergio, monetizables o no.

## Principios de proceso

1. **Spec antes que código.** Nada se implementa sin PRD/FRD con criterios de aceptación verificables (formato EARS cuando aplique). La spec es la fuente de verdad.
2. **Artefactos antes que chat.** Cada fase produce documentos versionados en el repo del proyecto. Las decisiones viven en archivos, no en conversaciones.
3. **Verificación determinista.** El modelo propone; scripts/CI/hooks verifican. Un agente jamás declara "terminado" por auto-reporte: tests verdes, lint limpio, criterios cumplidos.
4. **TDD por work order.** Tests de aceptación primero (RED), implementación mínima (GREEN), refactor después. Máximo 3 intentos de reparación por subtarea; luego se escala.
5. **Diseño antes de implementación.** Mockups navegables aprobados por Sergio antes de escribir código de producto. La implementación solo usa design tokens, nunca valores hardcodeados.
6. **Decisiones humanas mínimas y explícitas.** Solo: selección de ideas, elección de diseño, release a producción, gastar dinero, comunicaciones externas, borrado de datos, cambios de accesos. Todo lo demás: registro de decisiones (`fabrica/decisiones/registro.yaml`). Decisión no cubierta → escalar UNA vez → codificar la respuesta como regla.
7. **Cada intervención humana debe reducir las futuras.**

## Principios técnicos

8. **Estándares y stack.** Las **convenciones duraderas** (estructura, calidad, patrones, testing) son obligatorias e iguales en todo proyecto: ver `fabrica/estandares/`. El **stack es una sugerencia por defecto** (`fabrica/estandares/stack.md`, siempre en últimas versiones estables): el `architect` lo propone en el blueprint, puede sugerir mejores tecnologías si encajan, y **Sergio lo aprueba** ahí (gate humano ligero, registrado como ADR).
9. **Tipado estricto y calidad.** Tipado estricto en el lenguaje elegido (TS strict / mypy --strict), linter+formatter del stack, cero errores/warnings nuevos. Detalle en `fabrica/estandares/calidad.md`.
10. **Scaffold determinista.** Los proyectos nacen de plantillas/scaffolders oficiales + overlay Pandacorp, nunca improvisados.
11. **Git disciplinado.** Conventional Commits con scope, en inglés. Feature branches; nunca push directo a main; nunca force push. CI verde para mergear.
12. **Seguridad.** Secretos jamás en código ni en contexto de agentes (inyección por entorno). Dependencias con lockfile, sin CVEs conocidos, mantenidas en los últimos 12 meses. Nunca auth casero: Better Auth / Supabase Auth.
13. **Trazabilidad.** Decisiones arquitectónicas → ADR en `docs/adr/` del proyecto (incluye qué agente/modelo decidió y el trade-off aceptado).
14. **Implementación multi-agente.** La fase de implementación usa Agent Teams: agentes especializados (backend, frontend, testing) que se comunican entre sí y se pasan el trabajo con dependencias, no agentes sueltos secuenciales. Diseñar para Max 5x en proyectos (ver DR-013, DR-014): equipos de ≤3 agentes, líder en opus, obreros en sonnet/haiku. La construcción de la propia fábrica puede usar equipos mayores mientras el plan lo permita. Agent Teams es experimental: escribir el contexto crítico entre agentes a archivos, no solo a mensajes.

## Principios de producto

15. **Idioma**: documentos en español; código, commits, identificadores y nombres técnicos en inglés.
16. **UX/UI reforzado.** Sergio es débil en diseño: cada proyecto investiga referencias visuales, usa shadcn/ui + design tokens, genera 3 direcciones de diseño y verifica accesibilidad (axe-core) automáticamente antes del gate humano.
17. **Releases pequeños.** v1 = el corte mínimo que valida la hipótesis de valor. Iterar con `/pandacorp:new-version`.
18. **Testing por hito.** Cada FRD/work order cerrado se prueba al cerrarse, no al final. E2E solo en flujos críticos con `data-testid`.

## Separación fábrica/proyecto

19. La fábrica define el CÓMO (proceso, estándares, plantillas) y mantiene punteros (portfolio). Todo artefacto de producto vive en el repo del proyecto. El proyecto nunca necesita leer la fábrica para trabajar (el know-how llega vía plugin).
