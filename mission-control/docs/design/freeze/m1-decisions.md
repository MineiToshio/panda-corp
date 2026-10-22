# M1 owner decisions (2026-10-22, design freeze of Órbita)

The owner answered M1 and took every recommendation. These decisions bind S2 to S5.

1. **Drawn in the prototype and in v2 scope** (S2.1 draws each one as a configured state):
   - the global «⎇ N pendientes» indicator as a sidebar pill (like «Plugin desactualizado»), linking to Inicio's «Árboles de trabajo» (FRD-21, DR-096);
   - the «último commit en verde» snapshot panel with its command, in the project Resumen, shown only while a build runs (FRD-14, REQ-04-005);
   - the global accounts directory as a third Portafolio view (Tarjetas / Lista / Cuentas), reusing the Cuentas table (FRD-26);
   - the safety batch of 12 states from `reconciliation.md`: failing work order, build «sin señal», 6 read errors, calm Inicio, empty factory, drift badge, change-rebuilds-verified-work warning plus discard reason.
2. **Graphs, mixed:**
   - The dependency map (by FRD and by build step) adopts the prototype's layouts.
   - The data model keeps the app's current layout engine (owner-approved 2026-10-16). Its canvas is compared by computed styles (L1/L2), not pixels (L3).
3. **Confirmed as recommended in `reconciliation.md`:**
   - the 79 Group A items written into their FRDs with the pre-assigned ids;
   - the 35 Group B items out for v2;
   - the 20 contradictions amended to the prototype, except two where the FRD wins:
     - FRD-15: the dirty-plugin banner variant is removed from the prototype;
     - FRD-13: motion, so the prototype keeps only transform animations;
   - the 13 prototype corrections;
   - the copy fixes of `copy/frd-NN.md`, including:
     - «work order» instead of «orden», as an English artifact name with feminine agreement («work orders verificadas»);
     - «Documentación» instead of «Manual» as the surface name.

# M2 owner decisions (2026-10-22)

4. **Brand mark:** keep the existing raster emblem `docs/design/prototype/assets/pandacorp.png` as a recorded exception to the vector-logo rule. Mission Control is an internal tool and the emblem is the guild crest. The build serves the original bytes. `docs/design/prototype/logo/` holds the export: an SVG wrapper that embeds the PNG losslessly, plus the PNG itself and a README stating the exception.
5. **Theme control:** draw a small theme button (sun/moon) in the sidebar footer next to «Colapsar», and inside the drawer on phones. It starts from the system preference and remembers the owner's choice. The existing ThemeToggle stays, restyled to Órbita.
