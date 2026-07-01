"use client";

/**
 * LessonDetailModal — the shared detail overlay for a memory lesson (FRD-17).
 *
 * Reused by every memory surface that shows lessons (the candidate/prune streams and
 * the promotions queue): each holds its own selected-lesson state and renders THIS,
 * so the modal logic lives in one place. Reuses the core `Modal` + `Markdown` (DR-057).
 */

import { Chip } from "@/components/core/Chip/Chip";
import { Modal } from "@/components/core/Modal/Modal";
import type { Lesson } from "@/lib/memory/memory";
import { LessonDetail } from "./LessonDetail";

export function LessonDetailModal({
  lesson,
  onClose,
  command,
}: {
  lesson: Lesson | null;
  onClose: () => void;
  /** Optional copyable command shown in the detail (the promotions queue passes it). */
  command?: string;
}): React.JSX.Element {
  return (
    <Modal
      open={lesson !== null}
      onClose={onClose}
      title={lesson?.id ?? ""}
      testIdBase="lesson-detail"
      badge={lesson != null ? <Chip tone="accent">{lesson.type}</Chip> : undefined}
      width={620}
    >
      {lesson != null && <LessonDetail lesson={lesson} command={command} />}
    </Modal>
  );
}
