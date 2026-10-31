"use client";
import { Modal } from "@/components/core/Modal/Modal";
import { lessonPresentation } from "@/components/modules/PromotionsQueue/LessonRow";
import { t } from "@/lib/copy/copy";
import type { Lesson } from "@/lib/memory/memory";
import { LessonDetail } from "./LessonDetail";
/** Native shared lesson dialog with a type-tinted header and opener focus return. */
export function LessonDetailModal({
  lesson,
  onClose,
}: {
  readonly lesson: Lesson | null;
  readonly onClose: () => void;
}): React.JSX.Element {
  const meta = lessonPresentation(lesson?.type ?? "");
  return (
    <Modal
      open={lesson !== null}
      onClose={onClose}
      title={lesson?.id ?? ""}
      kicker={t("dialogs.lesson.kicker", { type: meta.label })}
      tone={meta.tone}
      testIdBase="lesson-detail"
    >
      {lesson && <LessonDetail lesson={lesson} />}
    </Modal>
  );
}
