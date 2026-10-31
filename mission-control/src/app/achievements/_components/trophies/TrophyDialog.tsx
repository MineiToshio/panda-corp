import { Chip } from "@/components/core/Chip/Chip";
import { Modal } from "@/components/core/Modal/Modal";
import type { Secret, Unique } from "@/lib/achievements/achievements";
import { t } from "@/lib/copy/copy";
import { categoryLabel, rarityPresentation } from "../../_utils/presentation";
import styles from "./trophies.module.css";

/** Actual trophy evidence only; secrets cannot be opened until earned. */
export function TrophyDialog({
  item,
  uniques,
  secrets,
  onClose,
}: {
  item: string;
  uniques: readonly Unique[];
  secrets: readonly Secret[];
  onClose: () => void;
}): React.JSX.Element | null {
  if (!item) return null;
  const unique = uniques.find((entry) => entry.name === item);
  const secret = secrets.find((entry) => entry.unlocked && entry.hint === item);
  if (!unique && !secret) return null;
  const rarity = unique ? rarityPresentation(unique.rarity) : null;
  const unlocked = unique?.unlocked ?? true;
  const date = unique?.date ?? secret?.date;
  const project = unique?.project ?? secret?.project;
  return (
    <Modal
      open
      onClose={onClose}
      title={item}
      kicker={t("dialogs.trophy.kicker")}
      tone={rarity?.tone ?? "violet"}
      testIdBase="trophy-dialog"
    >
      <div className={styles.chips}>
        {rarity ? <Chip tone={rarity.tone}>{rarity.label}</Chip> : null}
        <Chip tone="slate" variant="plain">
          {unique ? categoryLabel(unique.category) : t("logros.categories.secret")}
        </Chip>
        {!unlocked ? (
          <Chip tone="slate" icon="lock">
            {t("dialogs.trophy.locked")}
          </Chip>
        ) : date ? (
          <Chip tone="green" icon="check">
            {t("dialogs.trophy.unlocked", { date })}
          </Chip>
        ) : null}
      </div>
      <p>{unique?.condition ?? secret?.criterion ?? t("dialogs.trophy.noCondition")}</p>
      {project ? <p>{t("dialogs.trophy.project", { name: project })}</p> : null}
    </Modal>
  );
}
