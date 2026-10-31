import { Card, CardHeader } from "@/components/core/Card/Card";
import type { ChainState, Seal, Unique } from "@/lib/achievements/achievements";
import { t, tRich } from "@/lib/copy/copy";
import type { GuildLevel } from "@/lib/gamification/gamification";
import { type Attributes, attributeSummary, recentTrophies } from "../../_utils/viewRules";
import { AlmostThere } from "../../AlmostThere";
import { RadarChart } from "../charts/RadarChart";
import { SealTile } from "../trophies/SealTile";
import { TrophyCard } from "../trophies/TrophyCard";
import { NextRankCard } from "./NextRankCard";
import styles from "./summary.module.css";

/** Summary of real mission progress, seals, rank thresholds, recent unlocks and attributes. */
export function SummaryTab({
  chains,
  uniques,
  seals,
  level,
  axes,
  onOpen,
}: {
  chains: readonly ChainState[];
  uniques: readonly Unique[];
  seals: readonly Seal[];
  level: GuildLevel;
  axes: Attributes;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const recent = recentTrophies(uniques);
  const summary = attributeSummary(axes);
  const weak = summary.zero.length
    ? t("logros.summary.radarWeakZero", {
        list: summary.zero.map((key) => t(`logros.radar.${key}`)).join(", "),
      })
    : summary.weak
      ? t("logros.summary.radarWeakLowest", { label: t(`logros.radar.${summary.weak}`) })
      : "";
  return (
    <div className={`grid-2 ${styles.columns}`}>
      <div className={styles.stack}>
        <AlmostThere chains={chains} />
        <Card tone="gold">
          <CardHeader title={t("logros.summary.seals")} icon="shield" />
          <div className={styles.stack}>
            {seals.map((seal) => (
              <SealTile key={seal.axis} seal={seal} progress variant="row" />
            ))}
          </div>
        </Card>
      </div>
      <div className={styles.stack}>
        <NextRankCard level={level} />
        <Card tone="gold">
          <CardHeader title={t("logros.summary.recentTrophies")} icon="trophy" />
          {recent.length ? (
            <div className={styles.recent}>
              {recent.map((trophy) => (
                <TrophyCard key={trophy.name} trophy={trophy} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <p>{t("logros.summary.noTrophies")}</p>
          )}
        </Card>
        <Card tone="gold">
          <CardHeader title={t("logros.summary.attributes")} icon="radar" />
          <div className={`sum-radar ${styles.radar}`}>
            <RadarChart axes={axes} />
            <div>
              <p>
                {summary.strong
                  ? tRich("logros.summary.shape", {
                      strong: t(`logros.radar.${summary.strong}`),
                      weak,
                    })
                  : t("logros.summary.noAttributes")}
              </p>
              <a className={styles.link} href="/achievements/statistics">
                {t("logros.summary.seeStats")}
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
