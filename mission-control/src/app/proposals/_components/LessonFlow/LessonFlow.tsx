import { Fragment } from "react";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import type { OwnerActionsResult } from "@/lib/proposals/ownerActions";
import styles from "../ProposalsSummary/Proposals.module.css";

const STEPS = [
  { key: "rawNotes", sub: "rawNotesSub", tone: "slate", icon: "inbox" },
  { key: "candidates", sub: "candidatesSub", tone: "blue", icon: "bulb" },
  { key: "waiting", sub: "waitingSub", tone: "teal", icon: "rocket" },
  { key: "activeRules", sub: "activeRulesSub", tone: "violet", icon: "shield" },
] as const;
const ARROWS = ["dailyRoutine", "twoProjects", "youDecide"] as const;
/** Four lesson lifecycle stages, their actors and the recorded review freshness. */
export function LessonFlow({
  facts,
  upkeep,
  pruneCount,
}: {
  readonly facts: OwnerActionsResult["facts"];
  readonly upkeep: OwnerActionsResult["upkeep"];
  readonly pruneCount: number;
}): React.JSX.Element {
  return (
    <Card tone="teal">
      <CardHeader title={t("propuestas.memory.flow.title")} icon="activity" />
      <p className={styles.intro}>{t("propuestas.memory.flow.intro")}</p>
      <div className={`lf ${styles.flow}`}>
        {STEPS.map((step, index) => (
          <Fragment key={step.key}>
            <div className={`lf-step ${styles.step}`} data-tone={step.tone}>
              <Icon name={step.icon} size="sm" />
              <b>{facts[step.key] ?? t("common.relativeTime.noRecord")}</b>
              <strong>{t(`propuestas.memory.flow.${step.key}`)}</strong>
              <small>{t(`propuestas.memory.flow.${step.sub}`)}</small>
            </div>
            {index < 3 && (
              <div className={`lf-arrow ${styles.arrow} ${index === 2 ? styles.ownerArrow : ""}`}>
                <Icon name="arrow" />
                {t(`propuestas.memory.flow.${ARROWS[index] ?? "youDecide"}`)}
              </div>
            )}
          </Fragment>
        ))}
      </div>
      <p className={styles.meta}>
        {t("propuestas.memory.flow.lastReview", {
          date: upkeep.date ? formatDate(upkeep.date) : t("common.relativeTime.noRecord"),
        })}
        {upkeep.kind === "current"
          ? t("propuestas.memory.flow.upToDate")
          : upkeep.days !== null
            ? t("propuestas.memory.flow.daysAgo", { count: upkeep.days })
            : null}{" "}
        ·{" "}
        {pruneCount > 0
          ? t("propuestas.memory.flow.pruneCount", { count: pruneCount })
          : t("propuestas.memory.flow.pruneNone")}
      </p>
    </Card>
  );
}
