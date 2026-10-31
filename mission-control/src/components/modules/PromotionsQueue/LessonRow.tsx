import { BadgeIcon } from "@/components/core/BadgeIcon/BadgeIcon";
import { Chip } from "@/components/core/Chip/Chip";
import type { Tone } from "@/components/core/Chip/vocabulary";
import { type CopyKey, t } from "@/lib/copy/copy";
import type { Lesson } from "@/lib/memory/memory";
import styles from "./PromotionsQueue.module.css";

const TYPES: Record<string, { key: CopyKey; tone: Tone }> = {
  gotcha: { key: "propuestas.lessonTypes.gotcha", tone: "pink" },
  pattern: { key: "propuestas.lessonTypes.pattern", tone: "blue" },
  "library-verdict": { key: "propuestas.lessonTypes.libraryVerdict", tone: "teal" },
  "anti-pattern": { key: "propuestas.lessonTypes.antiPattern", tone: "pink" },
  "problem-solution": { key: "propuestas.lessonTypes.problemSolution", tone: "violet" },
};
/** Shared catalogue label and category hue for a lesson type. */
export function lessonPresentation(type: string): { label: string; tone: Tone } {
  const known = TYPES[type];
  return known ? { label: t(known.key), tone: known.tone } : { label: type, tone: "slate" };
}
/** Accessible lesson selection row, preserving source-language context. */
export function LessonRow({
  lesson,
  onSelect,
}: {
  readonly lesson: Lesson;
  readonly onSelect: (lesson: Lesson) => void;
}): React.JSX.Element {
  const meta = lessonPresentation(lesson.type);
  return (
    <button
      type="button"
      className={`lrow ${styles.lesson}`}
      data-lesson={lesson.id}
      aria-label={`${lesson.id} · ${lesson.context || t("propuestas.memory.lessonFallback")}`}
      onClick={() => onSelect(lesson)}
    >
      <BadgeIcon icon="bulb" tone={meta.tone} size="sm" />
      <span className={styles.grow}>
        <strong>{lesson.context || t("propuestas.memory.lessonFallback")}</strong>
        <small>
          {lesson.id} · {lesson.domain} · {lesson.projects.join(", ")}
        </small>
      </span>
      <Chip tone={meta.tone}>{meta.label}</Chip>
    </button>
  );
}
