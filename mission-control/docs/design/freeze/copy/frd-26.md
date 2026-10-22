# S1.4-26 · Copy reconciliation · FRD-26 (Services and account directory)

Summary: 4 mismatches judged, 2 stale FRD quotes (prototype string wins), 0 prototype copy errors, 2 both fine.

Sources: `docs/design/freeze/packs/frd-26.md` §4, FRD `docs/frds/frd-26-services-accounts/frd.md`, prototype `prototype.js` lines 906-919 (`SERVICE_STATUS`, `accountsView`) and the served state `#portfolio?project=funko-tracker&tab=Cuentas`.

| # | Mismatch | FRD quote | Prototype string | Verdict | Corrected string |
|---|---|---|---|---|---|
| 1 | View name | "Projects and Accounts views", "Accounts" | tab "Cuentas" | Both fine. The FRD is English spec text; the interface label is "Cuentas". S2.2 should record "Cuentas" as the UI label. The portfolio-level view has no drawn label (placement is for S1.3). | none |
| 2 | Detail concepts | "environment resources", "dated plan/quota observations" (AC-26-004) | column "Entornos" with chips "dev" / "prod"; no plan or quota text | FRD quote stale (prototype string wins). Iteration 19 replaced the plan with the login user; "Entornos" is the right Spanish word. | none |
| 3 | Statuses | "active, pending, candidate, reference" (AC-26-005) | "Configurado", "Propuesto", "Inactivo" (code also maps "Activo", "Planificado", "Pendiente", "Candidato") | FRD quote stale (prototype string wins). The FRD values are English data keys. Build note, not a copy fix: the code map has no entry for `reference`, and its fallback prints the raw key, so the build needs a label for it (suggested "Referencia"). | none for the strings drawn |
| 4 | Intro text | not in the FRD | "Servicios externos del proyecto según el directorio de la fábrica: para qué sirve cada uno, con qué usuario entrar y en qué entornos tiene recursos. Clic en el nombre para abrir su panel y en el usuario para copiarlo. Las credenciales nunca se muestran." | Both fine. Clear Spanish, one term per concept, consistent with "Clic para filtrar." elsewhere. Table headers (Servicio, Para qué, Usuario, Entornos, Estado), the link title "Abrir el panel de X en una pestaña nueva" and the copy `aria-label` "Copiar el usuario de X: correo" are also fine. | none |

Notes: the empty-cell marker is a lone "—" (`prototype.js` line 918, Usuario and Entornos columns). It is not a sentence separator, but under a strict reading of the no-em-dash rule the build should use another marker; left for the owner, not judged here.
