import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { Notice } from "@/components/core/Notice/Notice";
import { lessonPresentation } from "@/components/modules/PromotionsQueue/LessonRow";
import { buildLearnCommand } from "@/components/modules/PromotionsQueue/PromotionsQueue";
import { SectionedMarkdown } from "@/components/modules/SectionedMarkdown/SectionedMarkdown";
import { t } from "@/lib/copy/copy";
import type { Lesson } from "@/lib/memory/memory";
import styles from "./ProposalsSummary/Proposals.module.css";

function isHighRisk(lesson: Lesson): boolean {
  return (
    lesson.links.some((link) => link.trim().toUpperCase().startsWith("DR-")) ||
    lesson.domain.toLowerCase().includes("must")
  );
}
/** Catalogue metadata, retrieval trigger, sectioned evidence and the proposed-only command. */
export function LessonDetail({ lesson }: { readonly lesson: Lesson }): React.JSX.Element {
  const meta = lessonPresentation(lesson.type);
  return (
    <div data-testid="lesson-detail" className={styles.stack}>
      <div className={styles.chips}>
        <Chip tone={meta.tone}>{meta.label}</Chip>
        <Chip tone="slate">{lesson.domain}</Chip>
        <Chip tone="slate">{t(`dialogs.lesson.status.${lesson.status}`)}</Chip>
        {isHighRisk(lesson) && <Chip tone="coral">{t("dialogs.lesson.highRisk")}</Chip>}
        {lesson.promotion !== "none" && (
          <Chip tone="teal">
            {t("dialogs.lesson.promotion", {
              state:
                lesson.promotion === "approved"
                  ? t("propuestas.backlog.promotion.promoted")
                  : t(`propuestas.backlog.promotion.${lesson.promotion}`),
            })}
          </Chip>
        )}
        <Chip tone={lesson.evalGate === "corroborated" ? "teal" : "slate"}>
          {t(
            lesson.evalGate === "corroborated"
              ? "propuestas.backlog.evalGate.corroborated"
              : "propuestas.backlog.evalGate.awaitingSecond",
          )}
        </Chip>
      </div>
      {lesson.source && <p>{t("dialogs.lesson.source", { source: lesson.source })}</p>}
      {lesson.links.length > 0 && (
        <p>{t("dialogs.lesson.links", { links: lesson.links.join(", ") })}</p>
      )}
      <strong>{lesson.context}</strong>
      {lesson.trigger && (
        <Notice icon="target" tone="blue">
          {lesson.trigger}
        </Notice>
      )}
      <SectionedMarkdown body={lesson.body} />
      {lesson.appliedIn.length > 0 && (
        <p className={styles.meta}>
          {t("dialogs.lesson.appliedIn", { list: lesson.appliedIn.join(", ") })}
        </p>
      )}
      {lesson.promotion === "proposed" && (
        <>
          <p>{t("dialogs.lesson.promote")}</p>
          <CmdRow variant="box" command={buildLearnCommand(lesson)} />
        </>
      )}
    </div>
  );
}
