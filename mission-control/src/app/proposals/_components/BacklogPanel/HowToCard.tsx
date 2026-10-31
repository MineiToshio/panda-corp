import { Card, CardHeader } from "@/components/core/Card/Card";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { t } from "@/lib/copy/copy";
import styles from "./BacklogPanel.module.css";
/** Explains whole-queue and individual commands without executing either. */
export function HowToCard({
  count,
  firstId,
}: {
  readonly count: number;
  readonly firstId?: string;
}): React.JSX.Element {
  return (
    <Card tone="violet">
      <CardHeader title={t("propuestas.backlog.howTo.title")} icon="bolt" />
      <div className={styles.howto}>
        <p>
          <strong>{t("propuestas.backlog.howTo.allAtOnceLabel")}</strong>{" "}
          {t("propuestas.backlog.howTo.allAtOnce", { count })}
        </p>
        {count > 0 && <CmdRow command="/pandacorp:implement-backlog" variant="box" tone="violet" />}
        <p>
          <strong>{t("propuestas.backlog.howTo.oneByOneLabel")}</strong>{" "}
          {t("propuestas.backlog.howTo.oneByOne")}
        </p>
        {firstId && (
          <CmdRow command={`/pandacorp:implement-backlog ${firstId}`} variant="box" tone="violet" />
        )}
        <p>{t("propuestas.backlog.howTo.where")}</p>
      </div>
    </Card>
  );
}
