import { PageHead } from "@/components/core/PageHead/PageHead";
import { GuildHero } from "@/components/modules/GuildHero/GuildHero";
import { computeChains, computeSecrets, computeUniques } from "@/lib/achievements/achievements";
import { CHAIN_DEFINITIONS } from "@/lib/achievements/definitions";
import { computeStats } from "@/lib/achievements/stats";
import { now } from "@/lib/clock/clock";
import { t } from "@/lib/copy/copy";
import { getGuildState } from "@/lib/gamification/guildState";
import { HallTabs } from "./_components/HallTabs";
import { loadStatisticsData } from "./_components/Stats/loadStatisticsData";
import { attributesFor } from "./_utils/viewRules";

/** Server assembly over the existing achievement engine and the isolated statistics seam. */
export default async function HallPage(): Promise<React.JSX.Element> {
  const { level } = getGuildState();
  const statisticsData = loadStatisticsData();
  const { readerData } = statisticsData;
  const stats = computeStats(readerData);
  const chains = computeChains(stats);
  const uniques = computeUniques(readerData, now().getTime());
  const secrets = computeSecrets(readerData);
  const trophiesCount = uniques.filter((item) => item.unlocked).length;
  const tiersReached = chains.reduce((sum, chain) => sum + chain.currentTierIndex + 1, 0);
  return (
    <div data-testid="achievements-page" className="grid min-w-0 grid-cols-1">
      <PageHead title={t("logros.title")} subtitle={t("logros.subtitle")} />
      <HallTabs
        chains={chains}
        uniques={uniques}
        secrets={secrets}
        readerData={readerData}
        level={level}
        statisticsData={statisticsData}
        axes={attributesFor(stats, chains)}
        trophiesCount={trophiesCount}
        hero={
          <GuildHero
            level={level.level}
            title={level.title}
            xp={level.xp}
            next={level.next}
            pctToNext={level.pctToNext}
            rankIcon={level.icon}
            rankSprite={level.sprite}
            trophiesCount={trophiesCount}
            trophiesTotal={uniques.length}
            secretsCount={secrets.filter((item) => item.unlocked).length}
            secretsTotal={secrets.length}
            tiersReached={tiersReached}
            tiersTotal={CHAIN_DEFINITIONS.reduce((sum, chain) => sum + chain.tiers.length, 0)}
          />
        }
      />
    </div>
  );
}
