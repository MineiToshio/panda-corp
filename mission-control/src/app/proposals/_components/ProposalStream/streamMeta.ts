/**
 * streamMeta.ts — shared Spanish labels / empty-state copy + proposal id helpers
 * for the proposal streams (CMP-17-stream, WO-17-004 / WO-17-007 dismiss wiring).
 *
 * Extracted so both the read-only `ProposalStream` (Server Component) and the
 * `DismissableProposalStream` (client wrapper that adds the dismiss affordance)
 * share one source of the stream metadata and the stable proposal id — no
 * duplicated copy, no drift between the two surfaces.
 *
 * Traceability:
 *   CMP-17-stream → AC-17-004.5, REQ-17-008 (honest, dismissible)
 */

import type { Lesson } from "@/lib/memory/memory";
import type { Suggestion } from "@/lib/self-suggest/self-suggest";

export type StreamKind = "candidate-lesson" | "promotion" | "prune" | "self-suggestion";

export type StreamMeta = {
  label: string;
  description: string;
  emptyMessage: string;
};

export const STREAM_META: Record<StreamKind, StreamMeta> = {
  "candidate-lesson": {
    label: "Lecciones candidatas",
    description:
      "Lecciones capturadas que aguardan corroboración o revisión del gremio antes de activarse.",
    emptyMessage: "El gremio está al día — no hay lecciones candidatas pendientes.",
  },
  promotion: {
    label: "Propuestas de promoción",
    description:
      "Lecciones activas en ≥2 proyectos propuestas para convertirse en estándar, regla o habilidad.",
    emptyMessage: "La crónica está tranquila — no hay lecciones pendientes de promoción.",
  },
  prune: {
    label: "Propuestas de depuración",
    description: "Lecciones marcadas para reconciliar o archivar por `/pandacorp:memory review`.",
    emptyMessage: "La biblioteca del gremio está limpia — no hay lecciones para depurar.",
  },
  "self-suggestion": {
    label: "Sugerencias automáticas",
    description:
      "Oportunidades detectadas localmente por Mission Control desde los datos que ya lee (sin llamadas a Claude).",
    emptyMessage: "Todo en orden — el gremio no detectó cuellos de botella ni alertas.",
  },
};

/** Stable, store-compatible id for a lesson-based proposal. */
export function lessonProposalId(lesson: Lesson): string {
  return lesson.id;
}

/** Stable, store-compatible id for a self-suggestion proposal. */
export function suggestionProposalId(suggestion: Suggestion): string {
  return `${suggestion.kind}:${suggestion.target ?? suggestion.command}`;
}
