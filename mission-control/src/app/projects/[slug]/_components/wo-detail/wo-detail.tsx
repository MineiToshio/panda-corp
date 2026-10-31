import { Card } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { statePresentation } from "@/components/core/Chip/vocabulary";
import { CopyButton } from "@/components/core/CopyButton/CopyButton";
import { Crumbs } from "@/components/core/Crumbs/Crumbs";
import { Markdown } from "@/components/core/Markdown/Markdown";
import { Paper } from "@/components/modules/DocumentReader/Paper";
import { t } from "@/lib/copy/copy";
import type { ProjectFrd } from "@/lib/frds/frd-index";
import { navigationHref } from "@/lib/navigation/urls";
import { extractSections, type WorkOrderSections } from "@/lib/work-orders/sections";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { DetailFacts } from "./DetailFacts";
import { DetailStory } from "./DetailStory";
import { DetailTabs } from "./DetailTabs";
import styles from "./detail.module.css";
import { WoSteps } from "./WoSteps";
export type WoDetailTab = "summary" | "full";
export interface WorkOrderDetailProps {
  order: WorkOrder;
  content: string | null;
  activeWoTab: WoDetailTab;
  navigationBaseHref?: string;
  sections?: WorkOrderSections;
  dependents?: readonly WorkOrder[];
  orders?: readonly WorkOrder[];
  frd?: ProjectFrd;
}
/** Server-rendered reading summary; the only interactive island is the URL tab strip. */
export function WorkOrderDetail({
  order,
  content,
  activeWoTab,
  navigationBaseHref,
  sections = extractSections(content ?? "", order.summary),
  dependents = [],
  orders = [],
  frd,
}: WorkOrderDetailProps): React.JSX.Element {
  const href = navigationBaseHref ?? `?wo=${order.id}`;
  const back = navigationHref(href, { wo: null, woview: null, wotab: null });
  const full = navigationHref(href, { wo: order.id, woview: "full" });
  const presentation = statePresentation(order.state === "fail" ? "blocked" : order.state);
  const frdCode = frd?.code ?? `FRD-${order.frd.match(/^frd-(\d+)/i)?.[1] ?? ""}`;
  const title = order.title.replace(/^WO-\d+-\d+\s*[—–:·-]?\s*/, "");
  const metadata = content?.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  const markdown = (content ?? "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  return (
    <section data-testid="wo-detail" className={styles.root}>
      <Crumbs
        items={[
          { label: t("common.workspaceTabs.observabilidad"), href: back },
          { label: frdCode, href: navigationHref(back, { frd: frd?.slug ?? order.frd }) },
          { label: order.id },
        ]}
      />
      <Card tone={presentation.tone} variant="tinted">
        <div className={`wo-hero ${styles.hero}`}>
          <div className={styles.heroTop}>
            <div className={styles.chips}>
              <Chip tone={presentation.tone}>{order.id}</Chip>
              <Chip tone="slate" variant="plain">
                {frdCode}
                {frd ? ` · ${frd.title}` : ""}
              </Chip>
            </div>
            <a href={back} data-testid="wo-detail-back">
              {t("workspace.observabilidad.detail.back")}
            </a>
          </div>
          <h2 className="wo-title">{title}</h2>
          <WoSteps state={order.state} />
        </div>
      </Card>
      <DetailTabs active={activeWoTab} href={href} />
      <div
        role="tabpanel"
        id={`wo-pane-${activeWoTab}`}
        aria-labelledby={`wo-detail-tab-${activeWoTab}`}
        data-testid={`wo-detail-${activeWoTab}`}
      >
        {activeWoTab === "full" ? (
          <Paper
            type={t("workspace.observabilidad.detail.chipLabel")}
            path={order.relPath}
            tone="green"
          >
            <CopyButton
              value={content ?? ""}
              accessibleLabel={t("workspace.observabilidad.detail.copyDocument")}
            />
            {metadata && (
              <details className={styles.more}>
                <summary>{t("workspace.observabilidad.detail.metadata")}</summary>
                <Markdown>{`\`\`\`yaml\n${metadata}\n\`\`\``}</Markdown>
              </details>
            )}
            <Markdown>{markdown}</Markdown>
          </Paper>
        ) : (
          <div className={`wo-detail-grid ${styles.grid}`}>
            <DetailStory order={order} sections={sections} full={full} />
            <DetailFacts order={order} orders={orders} dependents={dependents} href={href} />
          </div>
        )}
      </div>
    </section>
  );
}
