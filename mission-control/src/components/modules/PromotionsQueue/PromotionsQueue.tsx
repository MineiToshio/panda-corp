"use client";
import { useState } from "react";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { CommandCompact } from "@/components/core/CmdRow/CmdRow";
import { MoreBar, pagedReveal } from "@/components/core/MoreBar/MoreBar";
import { t, tRich } from "@/lib/copy/copy";
import type { Lesson } from "@/lib/memory/memory";
import { LessonRow } from "./LessonRow";
import styles from "./PromotionsQueue.module.css";
/** Targeted promotion command for one lesson; never executed by the dashboard. */
export function buildLearnCommand(lesson: Lesson): string {
  return `/pandacorp:learn ${lesson.id}`;
}
/** Public promotions queue props contract. */
export interface PromotionsQueueProps {
  readonly lessons: readonly Lesson[];
  readonly recentLessons?: readonly Lesson[];
  readonly onSelectLesson?: (lesson: Lesson) => void;
}
/** Paged waiting lessons and newly recurring lessons, with selection emitted to the route. */
export function PromotionsQueue({
  lessons,
  recentLessons = [],
  onSelectLesson = () => {},
}: PromotionsQueueProps): React.JSX.Element {
  const queued = lessons.filter((x) => x.promotion === "proposed");
  const [pressed, setPressed] = useState(0);
  const page = pagedReveal(queued.length, pressed, 8);
  return (
    <Card tone="teal">
      <CardHeader
        title={t("propuestas.memory.waiting.title")}
        icon="rocket"
        count={queued.length + recentLessons.length}
      />
      <p className={styles.intro}>{tRich("propuestas.memory.waiting.intro")}</p>
      {queued.length + recentLessons.length === 0 && <p>{t("propuestas.summary.nothing")}</p>}
      {queued.slice(0, page.visible).map((lesson) => (
        <LessonRow key={lesson.id} lesson={lesson} onSelect={onSelectLesson} />
      ))}
      {page.remaining > 0 && (
        <MoreBar
          label={t("propuestas.showMore", { count: page.next, remaining: page.remaining })}
          onClick={() => setPressed(pressed + 1)}
        />
      )}
      {recentLessons.length > 0 && (
        <div className={styles.recent}>
          <h3 className="band-sub">{t("propuestas.memory.waiting.recent")}</h3>
          {recentLessons.map((lesson) => (
            <div key={lesson.id} className={styles.recentRow}>
              <LessonRow lesson={lesson} onSelect={onSelectLesson} />
              <Chip tone="teal">{t("propuestas.memory.waiting.newChip")}</Chip>
              <CommandCompact command={buildLearnCommand(lesson)} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
