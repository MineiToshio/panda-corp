import { Card, CardHeader } from "@/components/core/Card/Card";
import { Markdown } from "@/components/core/Markdown/Markdown";
import { t } from "@/lib/copy/copy";
import type { WorkOrderSections } from "@/lib/work-orders/sections";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { CriterionList } from "./CriterionList";
import styles from "./detail.module.css";
import { StatusNote } from "./StatusNote";
/** The source document's sections in their fixed reading order. */
export function DetailStory({
  order,
  sections,
  full,
}: {
  order: WorkOrder;
  sections: WorkOrderSections;
  full: string;
}): React.JSX.Element {
  const hasSections = Object.values(sections).some((value) =>
    Array.isArray(value) ? value.length > 0 : !!value,
  );
  return (
    <div className={`wo-story ${styles.story}`}>
      {sections.about && (
        <Card tone="teal">
          <CardHeader title={t("workspace.observabilidad.detail.about")} icon="file" />
          <Markdown>{sections.about}</Markdown>
        </Card>
      )}
      {(sections.scope || sections.outOfScope) && (
        <Card tone="blue">
          <CardHeader title={t("workspace.observabilidad.detail.scope")} icon="target" />
          {sections.scope && <Markdown>{sections.scope}</Markdown>}
          {sections.outOfScope && (
            <div className={`wo-out ${styles.out}`}>
              <h3>{t("workspace.observabilidad.detail.outOfScope")}</h3>
              <Markdown>{sections.outOfScope}</Markdown>
            </div>
          )}
        </Card>
      )}
      {!!sections.criteria.length && (
        <Card tone="green">
          <CardHeader title={t("workspace.observabilidad.detail.verify")} icon="check" />
          <CriterionList criteria={sections.criteria} />
        </Card>
      )}
      {sections.built && (
        <Card tone="violet">
          <CardHeader
            title={t(
              order.state === "review" || order.state === "done"
                ? "workspace.observabilidad.detail.built"
                : "workspace.observabilidad.detail.statusNote",
            )}
          />
          <StatusNote body={sections.built} />
        </Card>
      )}
      {!hasSections && <p>{t("workspace.observabilidad.detail.noSections")}</p>}
      <p className={`wo-lang ${styles.language}`}>
        {t("workspace.observabilidad.detail.language")}
      </p>
      <a className={styles.link} href={full}>
        {t("workspace.observabilidad.detail.readFull")}
      </a>
    </div>
  );
}
