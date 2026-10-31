"use client";
import type { BoardCardEntry } from "@/app/board/IdeaBoardView/IdeaBoardView";
import { ListRow } from "@/components/core/ListRow/ListRow";
import { Modal } from "@/components/core/Modal/Modal";
import { CATEGORY_LABELS } from "@/components/modules/IdeaCard/IdeaCard";
import { t } from "@/lib/copy/copy";
export interface DiscardedModalProps {
  open: boolean;
  onClose: () => void;
  cards: BoardCardEntry[];
  onSelect: (slug: string) => void;
}
/** Discarded ideas remain reachable with their recorded reason. */
export function DiscardedModal({
  open,
  onClose,
  cards,
  onSelect,
}: DiscardedModalProps): React.JSX.Element {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("dialogs.discardedIdeas.title", { count: cards.length })}
      kicker={t("dialogs.discardedIdeas.kicker")}
      testIdBase="discarded"
    >
      {cards.map((card) => (
        <ListRow
          key={card.slug}
          title={card.title}
          meta={t("dialogs.discardedIdeas.row", {
            category:
              CATEGORY_LABELS[card.projectType ?? ""]?.[0] ??
              card.projectType ??
              t("tablero.card.noCategory"),
          })}
          extra={
            card.discardReason
              ? t("dialogs.discardedIdeas.reason", { reason: card.discardReason })
              : undefined
          }
          onClick={() => onSelect(card.slug)}
        />
      ))}
    </Modal>
  );
}
