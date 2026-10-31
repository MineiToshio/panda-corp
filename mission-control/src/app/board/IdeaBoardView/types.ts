import type { IdeaCardProps } from "@/components/modules/IdeaCard/IdeaCard";
import type { BoardColumn as ColumnId } from "@/lib/board/board";
import type { WorkOrder } from "@/lib/work-orders/work-orders";

/** Board card data shared by the board and its consumers. */
export interface BoardCardEntry extends IdeaCardProps {
  /** Registered public idea slug, independent of the card filename. */
  navigationSlug?: string;
  /** Pre-computed two-axis column (set by page.tsx via deriveColumn). */
  boardColumn?: ColumnId;
  /** Live order states rendered in the card's progress indicator. */
  workOrders?: WorkOrder[];
  /** `discard_reason` (discarded cards only) — shown in the "Ver descartadas" modal + the detail. */
  discardReason?: string;
}
