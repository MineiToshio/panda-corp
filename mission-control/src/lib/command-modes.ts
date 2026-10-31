/** Shared clarification-mode catalog for campaign command disclosures. */

/** A selectable flag a command can carry (shape-compatible with CmdRow's CmdRowMode). */
export interface CommandMode {
  /** Flag folded into the command when active, e.g. "--ask" or "powerful". */
  flag: string;
  /** Human-readable option label, e.g. "ask" or "Potente". */
  label: string;
  /** One-line note shown while this mode is selected. */
  hint: string;
}

// ---------------------------------------------------------------------------
// spec — clarification modes (DR-095)
// ---------------------------------------------------------------------------

export const SPEC_MODES: ReadonlyArray<CommandMode> = [
  {
    flag: "--ask",
    label: "ask",
    hint: "Siempre te hace las preguntas clave antes de generar (default de new-idea).",
  },
  {
    flag: "--auto",
    label: "auto",
    hint: "Infiere lo que pueda y solo pregunta lo crítico (default de discover).",
  },
  {
    flag: "--infer",
    label: "infer",
    hint: "No pregunta nada: asume y marca cada supuesto como [ASSUMPTION].",
  },
];

/** Disclosure summary explaining what the spec modes control. */
export const SPEC_MODE_TITLE = "Cuántas preguntas te hago antes de generar la documentación";

/** Hover tooltip explaining what the implement mode field controls. */
export const IMPLEMENT_MODE_TITLE =
  "Modo de construcción — con cuánta potencia se construye el proyecto";
