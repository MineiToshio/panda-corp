"use client";
import { useState } from "react";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { CountPill } from "@/components/core/Chip/CountPill";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { MoreBar, pagedReveal } from "@/components/core/MoreBar/MoreBar";
import { LessonRow } from "@/components/modules/PromotionsQueue/LessonRow";
import { t } from "@/lib/copy/copy";
import type { Lesson } from "@/lib/memory/memory";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import { LessonDetailModal } from "../LessonDetailModal";
import styles from "../ProposalsSummary/Proposals.module.css";
/** Shared paged lesson list for collapsed candidates and conditional pruning. */
export function ProposalStream({
  kind,
  lessons,
}: {
  readonly kind: "candidate-lesson" | "prune";
  readonly lessons: readonly Lesson[];
}): React.JSX.Element | null {
  const [pressed, setPressed] = useState(0);
  const [id] = useUrlState("lesson", "");
  const [stream] = useUrlState("stream", "");
  const [tab] = useUrlState("proposalsTab", "resumen");
  const selected =
    (tab === "memoria" || tab === "memory") && stream === kind
      ? (lessons.find((x) => x.id === id) ?? null)
      : null;
  const select = (lesson: Lesson | null): void =>
    updateNavigation({
      proposalsTab: "memoria",
      lesson: lesson?.id ?? null,
      stream: lesson ? kind : null,
    });
  const page = pagedReveal(lessons.length, pressed, 10);
  if (kind === "prune" && lessons.length === 0) return null;
  const list = (
    <>
      {lessons.slice(0, page.visible).map((lesson) => (
        <LessonRow key={lesson.id} lesson={lesson} onSelect={select} />
      ))}
      {page.remaining > 0 && (
        <MoreBar
          label={t("propuestas.showMore", { count: page.next, remaining: page.remaining })}
          onClick={() => setPressed(pressed + 1)}
        />
      )}
    </>
  );
  return (
    <>
      {kind === "candidate-lesson" ? (
        <details className={styles.disclosure} data-tone="blue">
          <summary>
            <span>{t("propuestas.memory.candidates.title")}</span>
            <CountPill count={lessons.length} />
            <small>{t("propuestas.memory.candidates.hint")}</small>
          </summary>
          <p className={styles.intro}>{t("propuestas.memory.candidates.intro")}</p>
          {lessons.length === 0 ? <p>{t("common.none")}</p> : list}
        </details>
      ) : (
        <Card tone="slate">
          <CardHeader
            title={t("propuestas.memory.prune.title")}
            icon="archive"
            count={lessons.length}
          />
          <CmdRow variant="box" command="/pandacorp:memory review" />
          {list}
        </Card>
      )}
      <LessonDetailModal lesson={selected} onClose={() => select(null)} />
    </>
  );
}
