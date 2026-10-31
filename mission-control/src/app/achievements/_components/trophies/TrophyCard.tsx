import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import type { Unique } from "@/lib/achievements/achievements";
import { t } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import { rarityPresentation } from "../../_utils/presentation";
import styles from "./trophies.module.css";

export type TrophyView = Omit<Unique, "rarity" | "category"> & {
  rarity?: Unique["rarity"];
  category: Unique["category"] | "Secret";
};

/** Read-only trophy tile; no fabricated date and no estimated rarity or new badge. */
export function TrophyCard({
  trophy,
  onOpen,
}: {
  trophy: TrophyView;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const rarity = trophy.rarity ? rarityPresentation(trophy.rarity) : null;
  return (
    <button
      type="button"
      className={`trophy ${styles.trophy}`}
      data-tone={rarity?.tone ?? "violet"}
      data-trophy={trophy.name}
      data-locked={!trophy.unlocked}
      onClick={() => onOpen(trophy.name)}
    >
      <span className={`ticon ${styles.icon}`}>
        <Icon name={trophy.unlocked ? "trophy" : "lock"} />
      </span>
      <b>{trophy.name}</b>
      <small>{trophy.condition}</small>
      <span className={styles.chips}>
        {rarity ? <Chip tone={rarity.tone}>{rarity.label}</Chip> : null}
        {trophy.unlocked ? (
          trophy.date ? (
            <Chip tone="green" icon="check">
              {formatDate(trophy.date)}
            </Chip>
          ) : null
        ) : (
          <Chip tone="slate" variant="plain">
            {t("logros.trophy.locked")}
          </Chip>
        )}
      </span>
      {trophy.unlocked && trophy.project ? <small>{trophy.project}</small> : null}
    </button>
  );
}
