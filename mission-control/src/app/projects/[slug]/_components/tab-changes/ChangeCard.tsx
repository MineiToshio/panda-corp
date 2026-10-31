import { Chip } from "@/components/core/Chip/Chip";
import { ListRow } from "@/components/core/ListRow/ListRow";
import type { ChangeQueueItem } from "@/lib/changes/changes";
import { t } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import { itemStatusLabel, STATUS_TONES } from "./changePresentation";

/** Actionable queue row with an absolute date and the original source as a tooltip. */
export function ChangeCard({
  item,
  onSelect,
}: {
  item: ChangeQueueItem;
  onSelect?: (item: ChangeQueueItem) => void;
}): React.JSX.Element {
  return (
    <div data-testid="change-card" data-status={item.status} data-item={item.id} title={item.date}>
      <ListRow
        title={item.title}
        meta={[item.id, formatDate(item.date), item.frd].filter(Boolean).join(" · ")}
        icon={item.type === "bug" ? "alert" : "sparkles"}
        tone={item.type === "bug" ? "coral" : "pink"}
        onClick={onSelect ? () => onSelect(item) : undefined}
        extra={
          <>
            <Chip tone={item.type === "bug" ? "coral" : "pink"}>
              {t(
                item.type === "bug" ? "workspace.cambios.typeBug" : "workspace.cambios.typeChange",
              )}
            </Chip>
            <Chip tone={STATUS_TONES[item.status]}>{itemStatusLabel(item.status)}</Chip>
          </>
        }
      />
    </div>
  );
}
