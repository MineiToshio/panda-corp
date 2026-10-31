"use client";
import { PromotionsQueue } from "@/components/modules/PromotionsQueue/PromotionsQueue";
import type { Lesson } from "@/lib/memory/memory";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import { LessonDetailModal } from "../LessonDetailModal";
/** Connects waiting lesson selection to the URL-addressed detail dialog. */
export function PromotionsQueuePanel({
  lessons,
  recentLessons = [],
}: {
  readonly lessons: readonly Lesson[];
  readonly recentLessons?: readonly Lesson[];
}): React.JSX.Element {
  const [id] = useUrlState("lesson", "");
  const [stream] = useUrlState("stream", "");
  const [tab] = useUrlState("proposalsTab", "resumen");
  const selected =
    (tab === "memoria" || tab === "memory") && stream === "promotions"
      ? ([...lessons, ...recentLessons].find((x) => x.id === id) ?? null)
      : null;
  function select(lesson: Lesson | null): void {
    updateNavigation({
      proposalsTab: "memoria",
      lesson: lesson?.id ?? null,
      stream: lesson ? "promotions" : null,
    });
  }
  return (
    <>
      <PromotionsQueue lessons={lessons} recentLessons={recentLessons} onSelectLesson={select} />
      <LessonDetailModal lesson={selected} onClose={() => select(null)} />
    </>
  );
}
