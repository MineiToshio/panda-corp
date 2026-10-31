import { Icon } from "@/components/core/Icon/Icon";
import type { Secret } from "@/lib/achievements/achievements";
import { t } from "@/lib/copy/copy";
import { TrophyCard, type TrophyView } from "./TrophyCard";
import styles from "./trophies.module.css";

/** Locked secrets reveal only the cryptic hint; earned secrets become ordinary trophy tiles. */
export function SecretTile({
  secret,
  onOpen,
}: {
  secret: Secret;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  if (secret.unlocked) {
    const trophy: TrophyView = {
      name: secret.hint,
      category: "Secret",
      unlocked: true,
      condition: secret.criterion ?? t("dialogs.trophy.noCondition"),
      date: secret.date,
      project: secret.project,
    };
    return <TrophyCard trophy={trophy} onOpen={onOpen} />;
  }
  return (
    <div className={`secret-tile ${styles.secret}`} data-tone="violet">
      <Icon name="lock" />
      <b>{secret.hint}</b>
      <span>{t("logros.trophy.locked")}</span>
    </div>
  );
}
