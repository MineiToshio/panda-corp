# Open points reported by the S2 authors (input for the S3 audit)

The lead collected these from the S2.1 to S2.7 reports. Each one still has to be classified as BLOCKER or BACKLOG.

## FRD text vs captured prototype
- **FRD-06**
  - AC-06-001.6 puts a blocked or failing work order in Cola; the prototype draws WO-05-005 (Bloqueado) in Taller.
  - Three empty-station messages are in the FRD but in no captured state.
  - The `fragua-off` capture carries a parenthetical that exists only because the scene is forced off.
- **FRD-07**
  - REQ-07-005 says two skill groups; the prototype draws three («Otras»).
  - The DR-078 read-error state is not captured.
- **FRD-08:** the captured tutorial still says «Portfolio → Party», and the build-mode guide lists waves 2/4/8. REQ-08-013 asks for both to be refreshed. This is captured Manual content.
- **FRD-09:** only the preview notice («Vista previa del aviso») is captured; the real «¡Nuevo logro!» label is not.
- **FRD-02:** AC-02-016.5 says the idea header has a phase stepper; the capture draws only «Etapa: …».
- **FRD-03:** the no-remote variant of the missing-folder rule has no picture.
- **FRD-04**
  - The index label is «Elegir documento · N», not «Abrir índice».
  - The Cambios unreadable-files banner, the «Cerrando» group and a «Listos para construir» group on `project-changes` are not captured.
- **FRD-05:** REQ-05-001 puts Bloqueado before Verificado; the capture draws it after.
- **FRD-17**
  - The lesson trigger and «Aplicada en» are drawn in the lesson dialog, but the FRD marks them out of v2.
  - «Para podar» is not drawn.
- **FRD-18:** the FRD intro still says the heading is «Centro de mando»; the H1 is «Inicio».
- **FRD-19:** the FRD names the pill «⎇ N pendientes»; the capture reads «17 pendientes · depurar ya» with an alert icon.
- **FRD-22**
  - The «Abiertos» count reads 10 with 9 rows listed, so the prototype drops a no-priority item.
  - The empty filter result is not captured.
  - The item dialog has no section icons and no source/links/dates.
  - The confirm notice says «Esta maqueta…», which is prototype wording.
- **FRD-26**
  - The directory state labels (Activas / Pendientes / Candidatos / Referencia) differ from the FRD's (Configurado / Propuesto / Inactivo).
  - PostHog is «Inactivo» in the project tab and «Pendiente» in the directory.
  - AC-26-004's pending step is not drawn.
  - The project-tab invalid-source notice is not captured.

## Capture or reference defects
- **FRD-13**
  - The `a11y-skip-link-focus` shard HTML lacks the skip link, because it sits outside the screen selector.
  - The `a11y-ring-tooltip-focus` screenshots show «verificados» while the HTML says «verificadas», so they look stale.
- **`components.md`:** BottomNav still says «Manual» (the capture says «Docs»), the PendingPill row says "Planned", and the index label is wrong.
- **FDD frontmatter:** batch 1 set `prototype_blessed_at: '409a0564'` in the frontmatter, while the other batches put it only in `## Fidelity references`.

## Build-side findings (S2.6)
- **F1:** the scenario error copy is Spanish while the readers emit English reasons.
- **F2:** `accounts-source-error` cannot be produced as a file fault.
- **F3:** 77 action selectors must exist in the build.
- **F4:** there is no clock or git seam in `src`.

## Copy
- The microcopy keeps «captura» wording in not-found messages, which reads as prototype wording.

## Deviations recorded by S2.4 (`design-decisions.md` D-1 to D-8)
- Check whether S2.1 already removed the motion deviations (D-1).

## Owner question pending (M2)
- The brand mark `assets/pandacorp.png` is an AI raster with glow; there is no vector logo, and the gate's «exported logo SVGs» item is MISSING.
