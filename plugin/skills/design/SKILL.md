---
description: Fase de diseño UX/UI de un proyecto Pandacorp - investigación visual, sistema de diseño, 3 mockups HTML navegables con verificación de accesibilidad, y gate visual de Sergio. Usar dentro del proyecto después de /pandacorp:spec.
---

# /pandacorp:design

Fase de diseño. Se ejecuta EN el proyecto (requiere `docs/prd.md` y `docs/frds/` — si faltan, corre antes `/pandacorp:spec`).

## Pasos

1. **Investigación visual** (agente `designer`): referencias de 3-5 apps del dominio bien diseñadas → `docs/diseno/referencias.md`.
2. **Sistema de diseño**: el `designer` define `docs/diseno/design-tokens.json` (paleta, tipografía, espaciado, radios — base shadcn/ui; tweakcn.com como referencia de formato) y `DESIGN.md` en la raíz (tokens + componentes permitidos + prohibiciones).
3. **3 direcciones de diseño en paralelo** (3 agentes `designer`, uno por dirección, genuinamente distintas): `docs/diseno/mockups/direction-{1,2,3}.html` — autocontenidos, navegables, mobile-first, cubriendo las pantallas clave de los FRDs con textos reales.
4. **Verificación automática antes del gate**: screenshots 375px/1280px (Playwright) → `docs/diseno/mockups/screenshots/`; accesibilidad (axe-core) → `a11y-report.md`. Violaciones serias se corrigen ANTES de presentar.
5. **GATE VISUAL (Sergio)**: preséntale las 3 direcciones (abre los HTML o muéstrale los screenshots) y espera su elección o feedback. Itera si pide cambios.
6. **Congela el contrato**: dirección elegida → `design-tokens.json` final, `docs/diseno/decisiones-de-diseno.md` con el racional, borra ambigüedad de DESIGN.md.
7. **Actualiza** `docs/estado.yaml` → `fase: arquitectura`. Siguiente paso: `/pandacorp:blueprint`.

## Reglas
- La implementación posterior SOLO puede usar los tokens congelados — este contrato es el mecanismo que compensa la debilidad de Sergio en diseño.
- Estados vacíos, de carga y de error se diseñan aquí, no se improvisan al codear.
