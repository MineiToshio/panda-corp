import { Chip } from "@/components/core/Chip/Chip";
import { backlogAreaKey } from "@/lib/backlog/areas";
import type { BacklogItem } from "@/lib/backlog/backlog";
import { t } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import styles from "./BacklogPanel.module.css";
import { PRIORITY_TONE } from "./backlogPresentation";
/** Keyboard-operable backlog item row with type, area, date and priority. */
export function BacklogRow({
  item,
  onSelect,
}: {
  readonly item: BacklogItem;
  readonly onSelect: (item: BacklogItem) => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`lrow bl-row ${styles.row}`}
      aria-label={`${item.id} · ${item.title}`}
      data-backlog={item.id}
      onClick={() => onSelect(item)}
    >
      <span className={styles.id}>{item.id}</span>
      <span className={styles.grow}>
        <strong>{item.title}</strong>
        <small>
          {t(`propuestas.backlog.areas.${backlogAreaKey(item.area)}`)}
          {item.opened && ` · ${formatDate(item.opened)}`}
        </small>
      </span>
      <Chip tone={item.type === "bug" ? "coral" : "blue"} variant="outline">
        {t(item.type === "bug" ? "propuestas.backlog.rowBug" : "propuestas.backlog.rowChange")}
      </Chip>
      {item.severity && (
        <Chip tone={PRIORITY_TONE[item.severity]}>{t(`propuestas.priority.${item.severity}`)}</Chip>
      )}
    </button>
  );
}
