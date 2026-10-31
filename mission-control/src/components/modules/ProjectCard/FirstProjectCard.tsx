import { Card, CardHeader } from "@/components/core/Card/Card";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { EmptyState } from "@/components/core/EmptyState/EmptyState";
import { t } from "@/lib/copy/copy";
import styles from "./ProjectCard.module.css";

export function FirstProjectCard(): React.JSX.Element {
  return (
    <div className={`first-action ${styles.first}`}>
      <Card tone="teal">
        <CardHeader title={t("inicio.firstProject.title")} icon="bulb" />
        <EmptyState icon="bulb">{t("inicio.firstProject.intro")}</EmptyState>
        <p>{t("inicio.firstProject.captureStep")}</p>
        <CmdRow variant="box" command="/pandacorp:new-idea" />
        <p>{t("inicio.firstProject.convertStep")}</p>
        <CmdRow variant="box" command="/pandacorp:spec <idea>" />
      </Card>
    </div>
  );
}
