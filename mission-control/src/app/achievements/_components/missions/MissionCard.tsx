import { Card } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { Icon } from "@/components/core/Icon/Icon";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import type { ChainState } from "@/lib/achievements/achievements";
import { CHAIN_DEFINITIONS } from "@/lib/achievements/definitions";
import { type Rarity, tierRarityName } from "@/lib/achievements/tiers";
import { t } from "@/lib/copy/copy";
import { rarityPresentation } from "../../_utils/presentation";
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
  return (
    <article
      className={`mission ${styles.mission}`}
      data-untouched={chain.currentTierIndex < 0 && !chain.value}
      data-spot={spot}
      aria-label={chain.label}
    >
      <Card tone={spot ? "gold" : (rarity?.tone ?? "slate")}>
        <div className={styles.heading}>
          <Icon name="target" />
          <div>
            <h3>{chain.currentTierName ?? tiers[0]?.name ?? chain.label}</h3>
            <p>
              {chain.label}
              {chain.lowerIsBetter ? t("logros.missions.lowerIsBetter") : ""}
            </p>
          </div>
          <strong className={styles.percentage}>{pct}%</strong>
          <Chip tone={rarity?.tone ?? "slate"}>{rarity?.label ?? t("logros.missions.noTier")}</Chip>
        </div>
        {spot ? <Chip tone="gold">{t("logros.missions.oneStep")}</Chip> : null}
        <ol className={`tier-ladder ${styles.ladder}`} aria-label={t("logros.missions.allTiers")}>
          {tiers.map((tier, index) => (
            <li
              key={tier.name}
              data-reached={index <= chain.currentTierIndex}
              title={`${tier.name}: ${tier.threshold}`}
            >
              <span aria-hidden="true">{index <= chain.currentTierIndex ? "✓" : "○"}</span>
              <span className="sr-only">
                {tier.name}: {tier.threshold}
              </span>
            </li>
          ))}
        </ol>
        <p className={styles.goal}>{missionGoal(chain)}</p>
        <ProgressBar
          tone={rarity?.tone ?? "slate"}
          done={pct}
          total={100}
          ariaLabel={t("logros.missions.progressAria", {
            title: chain.label,
            pct,
            next: chain.nextTier?.name ?? t("logros.missions.end"),
          })}
        />
        <footer>{t("logros.missions.accumulated", { value: chain.value ?? 0 })}</footer>
      </Card>
    </article>
  );
}

function missionGoal(chain: ChainState): string {
  if (!chain.nextTier) return t("logros.missions.chainComplete");
  const vars = { value: chain.value ?? 0, threshold: chain.nextTier.threshold };
  if (chain.lowerIsBetter) return t("logros.missions.recordGoal", vars);
  return t("logros.missions.goal", { ...vars, next: chain.nextTier.name });
}
