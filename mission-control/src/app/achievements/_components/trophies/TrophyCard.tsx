import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import type { Unique } from "@/lib/achievements/achievements";
import { t } from "@/lib/copy/copy";
import { formatDate } from "@/lib/copy/dates";
import { categoryLabel, rarityPresentation } from "../../_utils/presentation";
import styles from "./trophies.module.css";

export type TrophyView = Omit<Unique, "rarity" | "category"> & {
  rarity?: Unique["rarity"];
  category: Unique["category"] | "Secret";
};

/** Read-only trophy tile; no fabricated date and no estimated rarity or new badge. */
export function TrophyCard({
  trophy,
  onOpen,
  variant = "catalogue",
}: {
  trophy: TrophyView;
  variant?: "catalogue" | "near" | "recent";
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const rarity = trophy.rarity ? rarityPresentation(trophy.rarity) : null;
  return (
    <button
      type="button"
      className={variant === "recent" ? `trophy ${styles.trophy}` : styles.trophy}
      aria-label={!trophy.unlocked ? `${trophy.name} · ${t("logros.trophy.locked")}` : undefined}
      data-variant={variant}
      data-tone={rarity?.tone ?? "violet"}
      data-trophy={trophy.name}
      data-locked={!trophy.unlocked}
      onClick={() => onOpen(trophy.name)}
    >
      <span className={`ticon ${styles.icon}`}>
        <Icon
          name={variant === "near" ? "target" : trophy.unlocked ? "trophy" : "lock"}
          size={variant === "recent" || trophy.unlocked ? "md" : "sm"}
        />
      </span>
      <span className={styles.details}>
        <b>{trophy.name}</b>
        <small>{trophy.condition}</small>
        <TrophyDetails trophy={trophy} variant={variant} />
      </span>
    </button>
  );
}

function TrophyDetails({
  trophy,
  variant,
}: {
  trophy: TrophyView;
  variant: "catalogue" | "near" | "recent";
}): React.JSX.Element {
  const rarity = trophy.rarity ? rarityPresentation(trophy.rarity) : null;
  if (variant === "recent") return <RecentDetails trophy={trophy} />;
  return (
    <>
      {rarity ? (
        <span className={styles.rarity} data-tone={rarity.tone}>
          <span className={styles.dot} aria-hidden="true" />
          {rarity.label}
          {variant === "near" ? ` · ${categoryLabel(trophy.category)}` : ""}
        </span>
      ) : null}
      {trophy.unlocked && trophy.date ? (
        <small>
          <Icon name="clock" size="sm" /> {formatDate(trophy.date)}
          {trophy.project ? ` · ${trophy.project}` : ""}
        </small>
      ) : null}
    </>
  );
}

function RecentDetails({ trophy }: { trophy: TrophyView }): React.JSX.Element {
  const rarity = trophy.rarity ? rarityPresentation(trophy.rarity) : null;
  return (
    <span className={styles.chips}>
      {rarity ? <Chip tone={rarity.tone}>{rarity.label}</Chip> : null}
      {trophy.unlocked && trophy.date ? (
        <Chip tone="green" icon="check">
          {formatDate(trophy.date)}
        </Chip>
      ) : null}
      {!trophy.unlocked ? (
        <Chip tone="slate" variant="plain">
          {t("logros.trophy.locked")}
        </Chip>
      ) : null}
    </span>
  );
}
