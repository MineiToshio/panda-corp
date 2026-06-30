/**
 * lib/achievements/report/verdict.ts — verdict + next-actions rule functions, WO-10-014.
 *
 * Platform golden rule (architecture §1): read-only, PURE deterministic functions over the
 * wired report aggregates — same inputs → same output. No fabricated sentence/suggestion:
 * each verdict line and each next-action is produced by an explicit rule from real metrics.
 *
 * Traceability: AC-10-014.6 (REQ-10-020, REQ-10-025).
 */

/** The aggregates the verdict/next-action rules read (already derived from real sources). */
export type ReportMetrics = {
  /** Projects launched (phase=release). */
  readonly launched: number;
  /** Active projects (design/architecture/implementation). */
  readonly wip: number;
  /** Ideas→launched conversion %. */
  readonly conversionPct: number;
  /** Discarded cards with no structured reason. */
  readonly discardsWithoutReason: number;
  /** Raw captured lesson notes (inbox). */
  readonly lessonCaptured: number;
  /** Distilled LESSON-*.md cards. */
  readonly lessonDistilled: number;
  /** Peak WO-verified week (records grid). */
  readonly peakWeek: number;
};

/** A factory command a next-action routes the owner to. */
export type ActionCommand = "/pandacorp:memory" | "/pandacorp:release" | "/pandacorp:recommend";

/** A single recommended next action, each carrying its command. */
export type NextAction = {
  readonly label: string;
  readonly command: ActionCommand;
};

/**
 * The capture-to-distilled ratio above which the memory backlog is worth harvesting.
 * 10× captured-per-distilled (or any captured with ≤1 distilled) signals an un-harvested inbox.
 */
const MEMORY_BACKLOG_RATIO = 10;

/**
 * Deterministic one-line factory verdict over the metrics (pure).
 * A finite set of rules selects one calm, sober sentence — never a fabricated claim.
 */
export function factoryVerdict(m: ReportMetrics): string {
  if (m.launched === 0 && m.wip === 0) {
    return "Sin proyectos activos ni lanzados todavía: la fábrica está en reposo.";
  }
  if (m.wip > 0 && m.launched === 0) {
    return `Construcción en curso (${m.wip} en marcha), aún sin lanzamientos.`;
  }
  if (m.launched > 0 && m.wip === 0) {
    return `${m.launched} lanzado(s) y sin construcción activa: momento de elegir el siguiente.`;
  }
  return `Fábrica en marcha: ${m.launched} lanzado(s) y ${m.wip} en construcción.`;
}

/** True when the captured backlog clearly outpaces what has been distilled. */
function hasMemoryBacklog(m: ReportMetrics): boolean {
  if (m.lessonCaptured === 0) return false;
  if (m.lessonDistilled === 0) return true;
  return m.lessonCaptured >= m.lessonDistilled * MEMORY_BACKLOG_RATIO;
}

/**
 * Deterministic ordered list of recommended next actions over the metrics (pure).
 * Each item carries its command (`/pandacorp:memory` | `/pandacorp:release` | `/pandacorp:recommend`).
 */
export function nextActions(m: ReportMetrics): NextAction[] {
  const actions: NextAction[] = [];

  if (hasMemoryBacklog(m)) {
    actions.push({
      label: `Destila ${m.lessonCaptured} notas capturadas en lecciones`,
      command: "/pandacorp:memory",
    });
  }

  if (m.wip > 0) {
    actions.push({
      label: `Acompaña hasta el lanzamiento ${m.wip} construcción(es) en marcha`,
      command: "/pandacorp:release",
    });
  }

  if (m.wip === 0) {
    actions.push({
      label: "Elige la siguiente idea a construir",
      command: "/pandacorp:recommend",
    });
  }

  return actions;
}
