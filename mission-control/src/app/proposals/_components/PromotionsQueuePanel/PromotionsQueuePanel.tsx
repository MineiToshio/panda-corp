"use client";

/**
 * PromotionsQueuePanel — the client wrapper that makes the promotions queue's cards
 * clickable (FRD-17, AC-17-006.7).
 *
 * It holds the selected-lesson state and renders the shared `LessonDetailModal`, so
 * the module-level `PromotionsQueue` (in `components/modules/`) stays free of a
 * route-local import: it only emits `onSelectLesson`, and the modal wiring lives here
 * at the route level — the same split the candidate/prune streams use. When a proposed
 * lesson is opened, the modal shows the copyable `/pandacorp:learn` command so the
 * owner can approve straight from the detail (rejected ones omit it).
 */

import { useState } from "react";
import {
  buildLearnCommand,
  PromotionsQueue,
} from "@/components/modules/PromotionsQueue/PromotionsQueue";
import type { Lesson } from "@/lib/memory/memory";
import { LessonDetailModal } from "../LessonDetailModal";

export function PromotionsQueuePanel({ lessons }: { lessons: Lesson[] }): React.JSX.Element {
  const [selected, setSelected] = useState<Lesson | null>(null);

  const command =
    selected != null && selected.promotion === "proposed" ? buildLearnCommand(selected) : undefined;

  return (
    <>
      <PromotionsQueue lessons={lessons} onSelectLesson={setSelected} />
      <LessonDetailModal lesson={selected} command={command} onClose={() => setSelected(null)} />
    </>
  );
}
