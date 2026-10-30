/**
 * The workspace tab labels, in order, as the shipped shell renders them (WO-04-004, `tabbar.tsx`
 * `WORKSPACE_TABS`; Cuentas added by FRD-26). The e2e specs share this one list so a tab change
 * updates a single place instead of going stale in each spec that asserts the tab bar.
 */
export const WORKSPACE_TAB_LABELS = [
  "Resumen",
  "Spec",
  "Observabilidad",
  "Arquitectura",
  "Cuentas",
  "Cambios",
  "Documentos",
  "Comandos",
] as const;
