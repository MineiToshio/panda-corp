import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import type { ChainState } from "@/lib/achievements/achievements";
import { CHAIN_DEFINITIONS } from "@/lib/achievements/definitions";
import { type Rarity, tierRarityName } from "@/lib/achievements/tiers";
import { t } from "@/lib/copy/copy";
import { rarityPresentation } from "../../_utils/presentation";
import { statIcon } from "../../_utils/statIcons";
import styles from "./missions.module.css";

/** One mission layout with honest progress; completed chains retain a full bar. */
export function MissionCard({
  chain,
  spot = false,
}: {
  chain: ChainState;
  spot?: boolean;
}): React.JSX.Element {
  const pct = Math.min(100, Math.max(0, chain.pctToNext));
  const rarity =
    chain.currentTierIndex >= 0
      ? rarityPresentation(tierRarityName(chain.currentTierIndex) as Rarity)
      : null;
  const tiers =
    CHAIN_DEFINITIONS.find((definition) => definition.statKey === chain.statKey)?.tiers ?? [];
  const title = missionTitle(chain, tiers);
  const next = chain.nextTier?.name ?? t("logros.missions.end");
  return (
    <article
      className={`mission ${styles.mission}`}
      data-untouched={!spot && !chain.value}
      data-spot={spot}
      aria-label={chain.label}
    >
      <div className={styles.heading}>
        <span className={styles.slot}>
          <Icon name={statIcon(chain.statKey)} size={spot ? "lg" : "sm"} />
        </span>
        <div>
          <div className={styles.titleRow}>
            {spot ? (
              <Chip tone="blue" icon="bolt">
                {t("logros.missions.oneStep")}
              </Chip>
            ) : null}
            <h3>{title}</h3>
            <Chip tone={rarity?.tone ?? "slate"} variant={rarity ? "tint" : "plain"}>
              {rarity?.label ?? t("logros.missions.noTier")}
            </Chip>
          </div>
          <p>
            {chain.label}
            {chain.lowerIsBetter ? t("logros.missions.lowerIsBetter") : ""}
          </p>
        </div>
        {spot ? (
          <strong className={styles.percentage}>
            {pct}
            <small>%</small>
          </strong>
        ) : null}
      </div>
      <ol className={`tier-ladder ${styles.ladder}`} aria-label={t("logros.missions.allTiers")}>
        {tiers.map((tier, index) => (
          <li
            key={tier.name}
            data-reached={index <= chain.currentTierIndex}
            data-current={index === chain.currentTierIndex}
            title={`${tier.name}: ${tier.threshold}`}
          >
            <span className="sr-only">
              {tier.name}: {tier.threshold}
            </span>
          </li>
        ))}
      </ol>
      <div className={styles.goal}>
        <span>
          <Icon name="arrow" size="sm" /> {next}
        </span>
        <span>
          {chain.nextTier
            ? `${chain.value ?? 0} / ${chain.nextTier.threshold}`
            : t("logros.missions.chainComplete")}
        </span>
      </div>
      <ProgressBar
        tone="gold"
        done={pct}
        total={100}
        ariaLabel={t("logros.missions.progressAria", {
          title: chain.label,
          pct,
          next,
        })}
      />
      <footer>{t("logros.missions.accumulated", { value: chain.value ?? 0 })}</footer>
    </article>
  );
}

function missionTitle(chain: ChainState, tiers: readonly { name: string }[]): string {
  return chain.currentTierName ?? tiers[0]?.name ?? chain.label;
}
