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

8. **Golden paths obligatorios.** Stack A (Next.js full-stack), B (Hono API), C (FastAPI), D (Python scraping/datos). Detalle en `docs/investigacion/04-stacks-recomendados.md`. Salirse requiere ADR y escalado la primera vez.
9. **Tipado estricto siempre.** TypeScript strict / mypy --strict. Lint con Biome (TS) / Ruff (Python). Cero errores, cero warnings nuevos.
10. **Scaffold determinista.** Los proyectos nacen de plantillas/scaffolders oficiales + overlay Pandacorp, nunca improvisados.
11. **Git disciplinado.** Conventional Commits con scope, en inglés. Feature branches; nunca push directo a main; nunca force push. CI verde para mergear.
12. **Seguridad.** Secretos jamás en código ni en contexto de agentes (inyección por entorno). Dependencias con lockfile, sin CVEs conocidos, mantenidas en los últimos 12 meses. Nunca auth casero: Better Auth / Supabase Auth.
13. **Trazabilidad.** Decisiones arquitectónicas → ADR en `docs/adr/` del proyecto (incluye qué agente/modelo decidió y el trade-off aceptado).

## Principios de producto

14. **Idioma**: documentos en español; código, commits, identificadores y nombres técnicos en inglés.
15. **UX/UI reforzado.** Sergio es débil en diseño: cada proyecto investiga referencias visuales, usa shadcn/ui + design tokens, genera 3 direcciones de diseño y verifica accesibilidad (axe-core) automáticamente antes del gate humano.
16. **Releases pequeños.** v1 = el corte mínimo que valida la hipótesis de valor. Iterar con `/pandacorp:new-version`.
17. **Testing por hito.** Cada FRD/work order cerrado se prueba al cerrarse, no al final. E2E solo en flujos críticos con `data-testid`.

## Separación fábrica/proyecto

18. La fábrica define el CÓMO (proceso, estándares, plantillas) y mantiene punteros (portfolio). Todo artefacto de producto vive en el repo del proyecto. El proyecto nunca necesita leer la fábrica para trabajar (el know-how llega vía plugin).
