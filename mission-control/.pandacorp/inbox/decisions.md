# Decisiones pendientes

## FRD-02 — Contradiciones FRD-vs-construcción (necesita propietario)

**Contexto:** El gate de FRD-02 clasificó un BLOQUEO (needs-owner). WO-02-014 está CORRECTO y ha pasado todas las pruebas. Sin embargo, existen dos contradicciones entre el texto de la FRD y lo que ya fue construido e VERIFICADO en WO-02-007 territorio:

### (1) AC-02-010.8 nunca fue construida

El AC requiere que en `src/components/modules/CampaignPipeline/phases.ts` se documente el flujo de la "Campaña" (foundation-first, olas disjuntas, loop de fidelidad por-WO, 4-lentes + gate de juez visual, Opción B wave-commit).

**Realidad actual:** El contenido se dejó fuera. La ficha de Diseño no menciona Claude Design ni components.md. La ficha de Arquitectura no planifica la base (primitivos compartidos) ni artefactos por-WO. La ficha de Construcción no describe el flujo v2.

**Mock aprobado:** `docs/frds/frd-02-ideas-board/mocks/la-campana.html:183,214` sí contiene ese texto.

**Historial:** El contenido entró en cc2a7e65 (2026-06-20), fue eliminado por revert 76054e96, y nunca volvió.

**Solución:** (a) Una prueba de reviewer contra PHASES falló en todas las 3 aserciones de AC-02-010.8 (la prueba no fue guardada). (b) El propietario debe elegir: (i) cola de cambios para agregar ~10 líneas de texto en `phases.ts` (fuente: mock), o (ii) enmendar AC-02-010.8 en la FRD.

### (2) AC-02-010.4 tiene un equipo desactualizado

El AC texto FRD dice: build = implementer+reviewer+analytics; release = security-auditor+devops, chain terminando en 'código → audit + deploy'.

**Realidad actual:** Código, fdd.md:150-157 y decision-log (2026-06-23, DR-085) dicen: build = implementer+reviewer+analytics+security-auditor; release = devops. El entregable de diseño no tiene components.md. `CampaignPipeline.test.tsx:398-406` prueba el roster DR-085, contradictorio con el texto FRD. `phases.ts:8-14` encabezado docstring aún reclama release = security-auditor+devops, contradictorio con sus propios datos (hallazgo de DR-115 doc-claim).

**Solución:** El propietario debe enmendar FRD-02 AC-02-010.4 con el roster DR-085 (el lado correcto, NO volver security-auditor a release). Luego re-gatear FRD-02.

**Próximos pasos:** 
1. Propietario elige acción (a) o (b) para AC-02-010.8
2. Propietario enmienda AC-02-010.4 (o invoca `/pandacorp:sync` o `/pandacorp:change`)
3. Re-ejecutar gate FRD-02

**Archivos de prueba guardados en worktree del gate:** Las pruebas adversariales del reviewer están salvaguardadas (listadas en testFiles del gate).

**Advisory (no bloquea):** `IdeaBoardView.tsx` encabezado docstring aún dice '7 columnas ... descartadas', pero renderiza 6. De review-only, persiste en main.
