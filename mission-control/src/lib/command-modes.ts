/**
 * command-modes — the single source of truth for the inline `<select>` modes that
 * CmdRow renders for commands that carry a flag (DR-092).
 *
 * Two commands have modes today, consumed in two places each (the board's Campaña
 * ficha and the project workspace Commands tab):
 *   - `spec`      → clarification modes --ask / --auto / --infer (DR-095).
 *   - `implement` → the build modes, DERIVED from the canonical BUILD_MODES catalog
 *                   (lib/constants). The default (balanced) carries no flag, so it is
 *                   the select's "no flag" option, not a listed mode.
 *
 * Keeping these here (not re-listed per call site) is the DR-092 single-source rule:
 * change a label or a flag once and every surface updates.
 */

import { BUILD_MODES, type BuildMode, DEFAULT_BUILD_MODE } from "@/lib/constants";

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

/** First "no flag" option label for the spec select — one word that names the field (it IS the
 * default, being first; the detail lives in the hint line below, keeping the select narrow). */
export const SPEC_MODE_DEFAULT_LABEL = "preguntas";

/** Hover tooltip (and could refine the aria) naming the spec mode field. */
export const SPEC_MODE_TITLE = "Modo de preguntas del spec";

// ---------------------------------------------------------------------------
// implement — build modes, derived from BUILD_MODES (DR-092)
// ---------------------------------------------------------------------------

/** Spanish display labels for the build modes (the BUILD_MODES catalog stores i18n keys). */
const BUILD_MODE_LABELS: Record<BuildMode, string> = {
  pro: "Pro",
  balanced: "Equilibrado",
  powerful: "Potente",
  deep: "Profundo",
};

/** One-line Spanish description per build mode (mirrors the FRD-11 prototype copy). */
const BUILD_MODE_HINTS: Record<BuildMode, string> = {
  pro: "1 agente a la vez, modelos económicos (sonnet/haiku). Más lento, mínimo consumo. Para plan Pro.",
  balanced:
    "Equipo de ≤3 agentes; líder opus, obreros sonnet/haiku. Por defecto, pensado para Max 5x.",
  powerful: "Hasta 5 agentes en paralelo → avanza más rápido. Para Max 20x.",
  deep: "Mejores modelos en todos + revisión adversarial extra. Para un proyecto especial.",
};

/** The base implement command — the flag (build mode id, or "") is appended to it. */
export const IMPLEMENT_BASE_COMMAND = "/pandacorp:implement";

/** The flag appended to the implement command for a build mode ("" for the default balanced). */
export function buildModeFlag(mode: BuildMode): string {
  const info = BUILD_MODES.find((m) => m.id === mode);
  if (info === undefined) return "";
  return info.command.replace(IMPLEMENT_BASE_COMMAND, "").trim();
}

/** Resolve a select flag value back to its BuildMode (for per-project persistence). */
export function buildModeFromFlag(flag: string): BuildMode {
  if (flag === "") return DEFAULT_BUILD_MODE;
  const info = BUILD_MODES.find((m) => buildModeFlag(m.id) === flag);
  return info?.id ?? DEFAULT_BUILD_MODE;
}

/**
 * Build modes for the implement select — every catalog mode except the default
 * (balanced = no flag, which is the select's "no flag" option).
 */
export const IMPLEMENT_MODES: ReadonlyArray<CommandMode> = BUILD_MODES.filter(
  (mode) => mode.id !== DEFAULT_BUILD_MODE,
).map((mode) => ({
  flag: buildModeFlag(mode.id),
  label: BUILD_MODE_LABELS[mode.id],
  hint: BUILD_MODE_HINTS[mode.id],
}));

/** First "no flag" option label for the implement select — the default mode's name (balanced),
 * short and consistent with Pro/Potente/Profundo; the detail lives in the hint line below. */
export const IMPLEMENT_MODE_DEFAULT_LABEL = "Equilibrado";

/** Hover tooltip naming the implement mode field. */
export const IMPLEMENT_MODE_TITLE = "Modo de construcción";

/** The default mode's description — shown as the select's hint when no flag is chosen. */
export const IMPLEMENT_DEFAULT_HINT = BUILD_MODE_HINTS[DEFAULT_BUILD_MODE];
