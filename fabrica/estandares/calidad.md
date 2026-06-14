# Calidad y testing

## Gates (verificados por scripts/CI, nunca por auto-reporte del agente)
Orden de validación antes de dar algo por terminado:
1. **Tests** (unit + integración) en verde.
2. **Type-check** estricto sin errores (`tsc --noEmit` / `mypy --strict`).
3. **Lint + formato** sin errores ni warnings nuevos (linter/formatter del stack).
4. **Build** limpio cuando aplique.

Estos comandos viven en `.pandacorp/verify.sh` del proyecto y los exige el hook `Stop` de la fábrica: un agente no puede declarar "terminado" si `verify.sh` falla.

**Endurecimiento del gate (DR-019):** `verify.sh` es **fail-closed** (cualquier salida ambigua o sin parsear = fallo, jamás "pasa por defecto"), corre en entorno limpio, **no expone al agente generador los nombres exactos de los tests** que debe pasar ni los fixtures, y emite **mensajes accionables** (qué regla falló y por qué — el feedback basado en reglas es el más efectivo para que un agente se auto-corrija; el "LLM-as-judge" no es confiable).

## Verificación adversarial e independiente (DR-015)
- El **generador y el verificador no pueden ser el mismo modelo**: los errores de un LLM se agrupan y sus tests heredan sus puntos ciegos. El `reviewer` (opus, idealmente de familia distinta al generador) **re-ejecuta** toda la evidencia y escribe **tests adversariales y de casos límite que el implementer no vio**.
- Los tests se anclan en **fuentes humanas** —criterios EARS de los FRDs y bugs reales de `docs/progreso.md`—, no en la imaginación del modelo.

## Mutation y property-based testing (DR-016)
- **Mutation testing** (Stryker en TS / mutmut en Python) detecta tests decorativos: si mutar el código no rompe ningún test, el test no prueba nada. Correr **al cerrar cada hito de FRD** y en CI hacia main (no en cada gate Stop — es caro). Mutation score objetivo ≥60% en lógica de negocio nueva.
- **Property-based** (fast-check / hypothesis) para lógica con invariantes (parsers, cálculos, serialización): genera cientos de casos que un humano no enumera.

## Estrategia de testing (por riesgo, no por % ciego)
- **Unit**: lógica de negocio, cálculos, validación, parsers.
- **Integración**: Server Actions + data layer + reglas juntas; integraciones con terceros.
- **E2E** (Playwright o equivalente): solo los flujos críticos del MVP (auth, flujo core, pagos), con selectores `data-testid` (nunca clases CSS).
- **No** testear markup trivial ni aserciones exactas de copy (usar roles ARIA).
- Cobertura de **ramas** sobre lógica de negocio (objetivo ≥80% en código nuevo).

## Higiene de E2E
- Los tests que crean datos los limpian en su teardown (claves deterministas). Nunca dejar datos de prueba en una BD compartida.

## TDD por work order
- Tests de los criterios de aceptación primero (RED) → implementación mínima (GREEN) → refactor. Máx. 3 intentos de reparación por subtarea, luego escalar.

## CI
- GitHub Actions en cada PR: type-check + lint + tests (en paralelo). E2E en PRs hacia main. Ramas protegidas; merge solo con CI verde.
- Hacia main (no en cada PR, por costo): **mutation testing** + **auditoría OWASP agentic** (DR-017) + generación de **changelog y ADRs** (DR-018, documentación viva). Los gates de CI son independientes del agente: el modelo nunca marca sus propios checks.
