# Calidad y testing

## Gates (verificados por scripts/CI, nunca por auto-reporte del agente)
Orden de validación antes de dar algo por terminado:
1. **Tests** (unit + integración) en verde.
2. **Type-check** estricto sin errores (`tsc --noEmit` / `mypy --strict`).
3. **Lint + formato** sin errores ni warnings nuevos (linter/formatter del stack).
4. **Build** limpio cuando aplique.

Estos comandos viven en `.pandacorp/verify.sh` del proyecto y los exige el hook `Stop` de la fábrica: un agente no puede declarar "terminado" si `verify.sh` falla.

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
