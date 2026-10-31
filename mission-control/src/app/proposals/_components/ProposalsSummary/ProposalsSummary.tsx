import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import { Notice } from "@/components/core/Notice/Notice";
import { t } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import type { OwnerActionsResult } from "@/lib/proposals/ownerActions";
import type { SignalGroupData } from "@/lib/proposals/signals";
import { ProposalActionRow } from "../ProposalActionRow/ProposalActionRow";
import { ProposalsTabLink } from "../ProposalsTabs/ProposalsTabs";
import { SignalGroup } from "../SignalGroup/SignalGroup";
import styles from "./Proposals.module.css";
/** Owner to-do, shared memory/backlog facts and grouped automatic signals. */
export function ProposalsSummary({
  result,
  signals,
  skillCount,
}: {
  readonly result: OwnerActionsResult;
  readonly signals: readonly SignalGroupData[];
  readonly skillCount: number;
}): React.JSX.Element {
  const { facts } = result;
  return (
    <div className={styles.stack}>
      <Card tone="amber">
        <div className={styles.summaryHeader}>
          <div>
            <CardHeader title={t("propuestas.summary.title")} icon="target" />
            <p className={styles.intro}>
              {result.actions.length > 0
                ? t("propuestas.summary.needYou", { count: result.badgeCount })
                : result.errors.length === 0
                  ? t("propuestas.summary.nothing")
                  : null}
            </p>
          </div>
          <Chip tone="amber">{t("propuestas.summary.forYou", { count: result.badgeCount })}</Chip>
        </div>
        {result.actions.length > 0 ? (
          <ol className={styles.actions}>
            {result.actions.map((action, index) => (
              <ProposalActionRow key={action.kind} action={action} index={index} />
            ))}
          </ol>
        ) : null}
        {result.upkeep.kind === "current" && !result.errors.some((x) => x.source === "memory") && (
          <div className={styles.memoryNote}>
            <Icon name="check" size="sm" />
            <p>
              <strong>{t("propuestas.actions.memoryFine.title")}</strong>{" "}
              {t("propuestas.actions.memoryFine.why", { date: formatDate(result.upkeep.date) })}
            </p>
          </div>
        )}
      </Card>
      <div className={styles.columns}>
        <Card tone="teal">
          <CardHeader title={t("propuestas.summary.memory.title")} icon="bulb" />
          <p className={styles.intro}>{t("propuestas.summary.memory.intro")}</p>
          {result.errors
            .filter((x) => x.source === "memory")
            .map((x) => (
              <Notice key={x.source} kind="error" icon="alert">
                {t("inicio.worktrees.unreadable")}: {x.message}
              </Notice>
            ))}
          <dl className={styles.facts}>
            {(["activeRules", "waiting", "candidates"] as const).map((key) => (
              <div
                key={key}
                className={styles.fact}
                data-tone={key === "waiting" ? "teal" : undefined}
              >
                <dt>{t(`propuestas.summary.memory.${key}`)}</dt>
                <dd>{facts[key] ?? t("common.relativeTime.noRecord")}</dd>
                {key === "candidates" && (
                  <dd className={styles.candidateNote}>
                    {t("propuestas.summary.memory.candidatesNote")}
                  </dd>
                )}
              </div>
            ))}
          </dl>
          <ProposalsTabLink href="/proposals/memory" className={styles.link}>
            {t("propuestas.summary.memory.link")}
            <Icon name="arrow" size="sm" />
          </ProposalsTabLink>
        </Card>
        <Card tone="blue">
          <CardHeader title={t("propuestas.summary.backlog.title")} icon="list" />
          <p className={styles.intro}>{t("propuestas.summary.backlog.intro")}</p>
          {result.errors
            .filter((x) => x.source === "backlog")
            .map((x) => (
              <Notice key={x.source} kind="error" icon="alert">
                {t("inicio.worktrees.unreadable")}: {x.message}
              </Notice>
            ))}
          <dl className={styles.facts}>
            {(["p0", "p1", "p2"] as const).map((key, index) => (
              <div
                key={key}
                className={styles.fact}
                data-tone={key === "p0" ? "coral" : key === "p1" ? "amber" : "slate"}
              >
                <dt>
                  {t(
                    index === 0
                      ? "propuestas.summary.backlog.urgent"
                      : index === 1
                        ? "propuestas.summary.backlog.important"
                        : "propuestas.summary.backlog.whenTime",
                  )}
                </dt>
                <dd>{facts.backlog?.[key] ?? t("common.relativeTime.noRecord")}</dd>
              </div>
            ))}
          </dl>
          {facts.backlog && (
            <p className={styles.meta}>
              {t("propuestas.summary.backlog.doing", { count: facts.backlog.doing })}
            </p>
          )}
          <ProposalsTabLink href="/proposals/backlog" className={styles.link}>
            {t("propuestas.summary.backlog.link")}
            <Icon name="arrow" size="sm" />
          </ProposalsTabLink>
        </Card>
      </div>
      <Card tone="slate">
        <CardHeader
          title={t("propuestas.signals.title")}
          icon="sparkles"
          count={signals.reduce((sum, x) => sum + x.items.length, 0)}
        />
        <p className={styles.intro}>{t("propuestas.signals.intro")}</p>
        {signals.length === 0 ? (
          <p>{t("common.none")}</p>
        ) : (
          signals.map((group) => (
            <SignalGroup key={group.kind} group={group} skillCount={skillCount} />
          ))
        )}
      </Card>
    </div>
  );
}
