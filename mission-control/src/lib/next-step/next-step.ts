/**
 * WO-02-003 — `nextStep` command map — CMP-02-next-step, IF-02-nextStep
 *
 * Traceability:
 *   AC-02-004.1  WHEN the owner clicks a card, the detail SHALL show the next-step command
 *                (with a copy button). This module supplies the pure status/phase → command map.
 *   REQ-02-004   Click a card → detail: summary, key points, docs navigator, next-step command.
 *   IF-02-nextStep  nextStep(input): NextStep
 *
 * Pipeline command strings (canonical source: CLAUDE.md operation table):
 *   discovered / recommended (not in-pipeline) → /pandacorp:spec <idea>
 *   in-pipeline + product              → /pandacorp:design
 *   in-pipeline + design               → /pandacorp:blueprint
 *   in-pipeline + architecture         → /pandacorp:implement
 *   in-pipeline + implementation       → /pandacorp:release
 *   in-pipeline + release              → /pandacorp:release
 *   in-pipeline + operation            → /pandacorp:iterate
 *   advancePending: true (any in-pipeline phase) → label carries the "ok, advance" hint (DR-032)
 *   shipped / discarded                → terminal, no pipeline progression command
 *
 * DR-032 (advance_pending): when a skill finishes a phase it sets advance_pending: true and
 * waits for the owner's "ok, advance." nextStep surfaces this as a distinguishable label so
 * the owner knows they need to give the go-ahead, not run the normal next command.
 *
 * Regression anchors:
 *   B1' (2026-06-16): NaN sneaks through typeof guards. readStatus rejects NaN upstream;
 *     phase arrives here as undefined. Undefined phase on in-pipeline must NOT produce a
 *     phase-specific command — it falls back to /pandacorp:spec <idea> (safe, not misleading).
 *   I3  (2026-06-16): array-shaped objects fool typeof. readStatus rejects array phase values;
 *     same undefined fallback applies.
 *
 * Pure function: no fs, no writes, no network, no side effects. Never throws.
 */

import type { IdeaStatus } from "../ideas/ideas";
import type { Phase } from "../status/status";

// ---------------------------------------------------------------------------
// WO-04-003 — CommandRow type and workspaceCommands (IF-04-next-step)
// ---------------------------------------------------------------------------

/**
 * A single row in the Commands tab: the command to copy and a description of
 * when to use it. (IF-04-next-step, REQ-04-005, AC-04-005.1)
 */
export interface CommandRow {
  /** The /pandacorp:* command string the owner should copy and run. */
  command: string;
  /** Human-readable description of when to use this command (Spanish, UI-facing). */
  when: string;
}

// ---------------------------------------------------------------------------
// Building-phase command rows (implementation / release)
// ---------------------------------------------------------------------------

const BUILDING_ROWS: readonly CommandRow[] = [
  {
    command: "/pandacorp:implement",
    when: "Continúa o reanuda la construcción del proyecto",
  },
  {
    command: "/pandacorp:release",
    when: "Cuando todos los work orders estén listos para lanzar",
  },
  {
    command: "/pandacorp:iterate",
    when: "Agrega un FRD, ajusta o corrige algo en el proyecto",
  },
];

// ---------------------------------------------------------------------------
// Operation-phase command rows
// ---------------------------------------------------------------------------

const OPERATION_ROWS: readonly CommandRow[] = [
  {
    command: "/pandacorp:iterate",
    when: "Itera sobre el proyecto: agrega, ajusta o corrige",
  },
  {
    command: "/pandacorp:new-version",
    when: "Comienza un nuevo hito o versión mayor del proyecto",
  },
];

// ---------------------------------------------------------------------------
// Early-phase delegation map (FRD-02 base, single next-step command per phase)
// ---------------------------------------------------------------------------

/** Labels describing when to use each early-phase command (Spanish). */
const EARLY_PHASE_WHEN: Readonly<Record<Phase, string>> = {
  product: "Ejecuta el diseño del producto",
  design: "Crea el blueprint de arquitectura",
  architecture: "Inicia la implementación del proyecto",
  // Building / operation phases are NOT in this delegation path.
  // These entries are present only to satisfy the Record<Phase, …> constraint;
  // workspaceCommands handles implementation / release / operation directly.
  implementation: "Continúa o reanuda la construcción",
  release: "Completa el lanzamiento",
  operation: "Itera o revisa el lanzamiento",
};

// Fallback row for unknown / undefined phases (regression B1', I3).
const FALLBACK_ROW: CommandRow = {
  command: "/pandacorp:spec <idea>",
  when: "Crea la spec del proyecto antes de comenzar",
};

/**
 * Map a project phase to the stage-relevant command rows shown in the
 * Commands tab (REQ-04-005, AC-04-005.1, IF-04-next-step).
 *
 * Pure: no I/O, no writes, no network, no side effects. Never throws.
 * Same input → same output every time (deterministic).
 *
 * @param phase - The project phase from `.pandacorp/status.yaml`. Runtime
 *   callers may pass undefined (B1', I3 regressions) — handled safely.
 * @returns A non-empty CommandRow[] with at least one row. Never returns
 *   an empty array.
 */
export function workspaceCommands(phase: Phase): CommandRow[] {
  // --- Building phases: implement + release + iterate ---
  if (phase === "implementation" || phase === "release") {
    // Deep-copy each row object so callers cannot mutate shared module constants
    // (adversarial: `[...BUILDING_ROWS]` copies the array but row objects would
    // still alias BUILDING_ROWS[n] by reference — pure-function contract broken).
    return BUILDING_ROWS.map((r) => ({ ...r }));
  }

  // --- Operation phase: iterate + new-version ---
  if (phase === "operation") {
    // Same deep-copy requirement as building rows above.
    return OPERATION_ROWS.map((r) => ({ ...r }));
  }

  // --- Early phases: delegate to FRD-02 base map (single next-step command) ---
  // This covers: product, design, architecture.
  if (phase === "product" || phase === "design" || phase === "architecture") {
    // Delegate to FRD-02 PHASE_COMMANDS for the command string.
    const command = PHASE_COMMANDS[phase];
    const when = EARLY_PHASE_WHEN[phase];
    return [{ command, when }];
  }

  // --- Unknown / undefined phase (regression B1', I3) ---
  // Never throw; return a safe, non-misleading fallback. Never return a
  // building-phase command for an unrecognised phase (would be misleading).
  return [{ ...FALLBACK_ROW }];
}

// ---------------------------------------------------------------------------
// Types (exported — consumed by FRD-02 card detail, FRD-03/04)
// ---------------------------------------------------------------------------

export type NextStep = {
  /** The /pandacorp:* command string the owner should copy and run. */
  command: string;
  /**
   * Absolute path of the folder to open before running the command.
   * Present only for in-pipeline cards where there is a project folder.
   * Undefined for pre-pipeline cards (discovered/recommended) and terminal states.
   */
  openPath?: string;
  /** Human-readable label describing the action (Spanish, UI-facing). */
  label: string;
};

export type NextStepInput = {
  cardStatus?: IdeaStatus;
  phase?: Phase;
  advancePending?: boolean;
};

// ---------------------------------------------------------------------------
// Mapping table constants (locked; each mutation target is a separate literal)
// ---------------------------------------------------------------------------

const CMD_SPEC = "/pandacorp:spec <idea>";
const CMD_DESIGN = "/pandacorp:design";
const CMD_BLUEPRINT = "/pandacorp:blueprint";
const CMD_IMPLEMENT = "/pandacorp:implement";
const CMD_RELEASE = "/pandacorp:release";
const CMD_ITERATE = "/pandacorp:iterate";

// ---------------------------------------------------------------------------
// Phase → command map
// ---------------------------------------------------------------------------

const PHASE_COMMANDS: Readonly<Record<Phase, string>> = {
  product: CMD_DESIGN,
  design: CMD_BLUEPRINT,
  architecture: CMD_IMPLEMENT,
  implementation: CMD_RELEASE,
  release: CMD_RELEASE,
  operation: CMD_ITERATE,
};

const PHASE_LABELS: Readonly<Record<Phase, string>> = {
  product: "Ejecutar diseño",
  design: "Crear blueprint",
  architecture: "Iniciar implementación",
  implementation: "Lanzar release",
  release: "Completar release",
  operation: "Iterar o revisar lanzamiento",
};

// DR-032: advance_pending label suffix — must differ from the non-pending label
// to surface the pending state to the owner.
const ADVANCE_PENDING_SUFFIX = " — escribe «ok, advance» para continuar";

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Map a card's lifecycle position to the next `/pandacorp:*` command to run.
 *
 * Pure: no I/O, no writes, no side effects. Never throws.
 *
 * @param input - Partial lifecycle position. All fields are optional; absent
 *   fields produce a safe, deterministic fallback (never a wrong phase command).
 * @returns A fully-typed NextStep with non-empty command and label.
 */
export function nextStep(input: NextStepInput): NextStep {
  const { cardStatus, phase, advancePending } = input;

  // --- Terminal states: shipped / discarded ---
  if (cardStatus === "shipped") {
    return {
      command: "/pandacorp:review-launch",
      label: "Revisar métricas de lanzamiento",
    };
  }

  if (cardStatus === "discarded") {
    return {
      command: "/pandacorp:recommend",
      label: "Ver ideas recomendadas",
    };
  }

  // --- in-pipeline: map phase → command ---
  if (cardStatus === "in-pipeline") {
    // Regression B1' + I3: phase may be undefined if readStatus rejected an
    // invalid value upstream. Fall back to spec (pre-pipeline safe) rather than
    // picking a wrong phase command.
    if (phase !== undefined && phase in PHASE_COMMANDS) {
      const command = PHASE_COMMANDS[phase];
      const baseLabel = PHASE_LABELS[phase];

      // DR-032: advancePending=true → distinguishable label so the owner knows
      // to give the "ok, advance" acknowledgement, not just run the command.
      const label = advancePending === true ? baseLabel + ADVANCE_PENDING_SUFFIX : baseLabel;

      return { command, label };
    }

    // phase is undefined (malformed YAML, missing key, upstream rejection) —
    // safe fallback: treat as not-yet-spec'd rather than guessing a phase.
    return {
      command: CMD_SPEC,
      label: "Crear spec del proyecto",
    };
  }

  // --- Pre-pipeline: discovered / recommended ---
  // (also covers: undefined cardStatus, phase-only input, unknown statuses)
  return {
    command: CMD_SPEC,
    label: "Crear spec del proyecto",
  };
}
