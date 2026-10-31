import type { Metadata } from "next";
import { Notice } from "@/components/core/Notice/Notice";
import { PageHead } from "@/components/core/PageHead/PageHead";
import { t } from "@/lib/copy/copy";
import { loadProposalsData } from "@/lib/proposals/data";
import { ownerActions } from "@/lib/proposals/ownerActions";
import { groupSignals } from "@/lib/proposals/signals";
import { BacklogPanel } from "./_components/BacklogPanel/BacklogPanel";
import { LessonFlow } from "./_components/LessonFlow/LessonFlow";
import { PromotionsQueuePanel } from "./_components/PromotionsQueuePanel/PromotionsQueuePanel";
import { ProposalStream } from "./_components/ProposalStream/ProposalStream";
import styles from "./_components/ProposalsSummary/Proposals.module.css";
import { ProposalsSummary } from "./_components/ProposalsSummary/ProposalsSummary";
import { ProposalsTabs } from "./_components/ProposalsTabs/ProposalsTabs";
export const metadata: Metadata = {
  title: t("propuestas.title"),
  description: t("propuestas.subtitle"),
};
/** Server composition over one request-cached data bundle and owner-actions resolver. */
export default function ProposalsPage(): React.JSX.Element {
  const data = loadProposalsData();
  const result = ownerActions();
  const prunables = data.lessons.filter((x) => x.status === "deprecated");
  const memoryPanel = (
    <div className={styles.stack}>
      {data.memoryError ? (
        <Notice kind="error" icon="alert">
          {t("propuestas.summary.memory.title")}: {t("inicio.worktrees.unreadable")} (
          {data.memoryError})
        </Notice>
      ) : (
        <>
          <LessonFlow facts={result.facts} upkeep={result.upkeep} pruneCount={prunables.length} />
          <PromotionsQueuePanel
            lessons={result.waitingLessons.filter((x) => x.promotion === "proposed")}
            recentLessons={result.recentLessons}
          />
          <ProposalStream
            kind="candidate-lesson"
            lessons={data.lessons.filter((x) => x.status === "candidate")}
          />
          <ProposalStream kind="prune" lessons={prunables} />
        </>
      )}
    </div>
  );
  return (
    <div data-testid="proposals-page">
      <PageHead title={t("propuestas.title")} subtitle={t("propuestas.subtitle")} />
      <ProposalsTabs
        summaryPanel={
          <ProposalsSummary
            result={result}
            signals={groupSignals(data.suggestions, data.skillCount)}
            skillCount={data.skillCount}
          />
        }
        memoryPanel={memoryPanel}
        backlogPanel={
          <div className={styles.stack}>
            <BacklogPanel result={data.backlog} />
          </div>
        }
        backlogOpenCount={result.facts.backlog?.actionable}
        waitingCount={result.facts.waiting ?? undefined}
      />
    </div>
  );
}
