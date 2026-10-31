import { Button } from "@/components/core/Button/Button";
import { Chip } from "@/components/core/Chip/Chip";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { SectionedMarkdown } from "@/components/modules/SectionedMarkdown/SectionedMarkdown";
import { backlogAreaKey } from "@/lib/backlog/areas";
import type { BacklogItem } from "@/lib/backlog/backlog";
import { t } from "@/lib/copy/copy";
import styles from "./BacklogPanel.module.css";
import { PRIORITY_TONE } from "./backlogPresentation";
/** Read-only item content; actionable items expose commands and the bounded discard confirmation. */
export function BacklogDetail({
  item,
  onConfirm,
}: {
  readonly item: BacklogItem;
  readonly onConfirm: () => void;
}): React.JSX.Element {
  const actionable = item.status === "open" || item.status === "doing";
  return (
    <div className={styles.dialog}>
      <div className={styles.chips}>
        {item.severity && (
          <Chip tone={PRIORITY_TONE[item.severity]}>
            {t(`propuestas.priority.${item.severity}`)}
          </Chip>
        )}
        <Chip tone={item.type === "bug" ? "coral" : "blue"} variant="outline">
          {t(item.type === "bug" ? "propuestas.backlog.rowBug" : "propuestas.backlog.rowChange")}
        </Chip>
        <Chip tone="slate">{t(`propuestas.backlog.status.${item.status}`)}</Chip>
        <Chip tone="slate">{t(`propuestas.backlog.areas.${backlogAreaKey(item.area)}`)}</Chip>
      </div>
      <SectionedMarkdown body={item.body} />
      {actionable && (
        <>
          <CmdRow variant="box" command={`/pandacorp:implement-backlog ${item.id}`} />
          <Button variant="danger" onClick={() => onConfirm()}>
            {t("dialogs.backlogItem.discard")}
          </Button>
        </>
      )}
    </div>
  );
}
