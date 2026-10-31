"use client";

import { notFound } from "next/navigation";
import { Tabs } from "@/components/core/Tabs/Tabs";
import {
  type ChainState,
  computeSeals,
  type Secret,
  type Unique,
} from "@/lib/achievements/achievements";
import type { ReportScalars } from "@/lib/achievements/report/types";
import { computeStats, type ReaderData } from "@/lib/achievements/stats";
import { t } from "@/lib/copy/copy";
import type { GuildLevel } from "@/lib/gamification/gamification";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import { type Attributes, attributesFor } from "../_utils/viewRules";
import type { InformeData } from "../Informe/informeData";
import { RankLadder } from "../RankLadder/RankLadder";
import type { StatsRecords } from "../StatsPanel";
import { MissionsTab } from "./missions/MissionsTab";
import { type StatisticsData, StatisticsTab } from "./Stats/StatisticsTab";
import { SummaryTab } from "./summary/SummaryTab";
import { TrophiesTab } from "./trophies/TrophiesTab";
import { TrophyDialog } from "./trophies/TrophyDialog";

const TABS = ["resumen", "misiones", "trofeos", "estadisticas", "rangos"] as const;
const ICONS = {
  resumen: "grid",
  misiones: "target",
  trofeos: "trophy",
  estadisticas: "chart",
  rangos: "stairs",
} as const;
interface HallTabsProps {
  chains: readonly ChainState[];
  uniques: readonly Unique[];
  secrets: readonly Secret[];
  readerData: ReaderData;
  level: GuildLevel;
  hero: React.ReactNode;
  trophiesCount: number;
  /** Compatibility with frozen reviewer callers; counts derive from the engine DTOs. */
  trophiesTotal?: number;
  missionsActive?: number;
  axes?: Attributes;
  statisticsData?: StatisticsData;
  informeData?: InformeData;
  statsScalars?: ReportScalars;
  statsRecords?: StatsRecords;
}
/** Five URL-selected views share one hero, accessible tab strip and trophy dialog. */
export function HallTabs({
  chains,
  uniques,
  secrets,
  readerData,
  level,
  hero,
  trophiesCount,
  axes,
  statisticsData,
  informeData,
  statsScalars,
  statsRecords,
}: HallTabsProps): React.JSX.Element {
  const [tab] = useUrlState("hallTab", "resumen");
  const [trophy, setTrophy] = useUrlState("trophy", "");
  if (!TABS.some((entry) => entry === tab)) return notFound();
  if (
    trophy &&
    !uniques.some((entry) => entry.name === trophy) &&
    !secrets.some((entry) => entry.unlocked && entry.hint === trophy)
  )
    return notFound();
  const active = tab as (typeof TABS)[number];
  const seals = computeSeals(uniques);
  const attributes = axes ?? attributesFor(computeStats(readerData), chains);
  function handleTab(id: string): void {
    updateNavigation({ hallTab: id, trophy: null });
  }
  return (
    <div data-testid="logros-tabs" className="grid min-w-0 grid-cols-1 gap-5">
      {hero}
      <Tabs
        tabs={TABS.map((id) => ({
          id,
          label: t(`logros.tabs.${id}`),
          icon: ICONS[id],
          tone: "gold",
          count: id === "trofeos" ? trophiesCount : undefined,
        }))}
        active={active}
        onChange={handleTab}
        ariaLabel={t("logros.tabs.aria")}
        testIdPrefix="logros-tab-"
        tabIdPrefix="logros-tab-"
        panelIdPrefix="logros-panel-"
      />
      <div role="tabpanel" id={`logros-panel-${active}`} aria-labelledby={`logros-tab-${active}`}>
        {active === "resumen" ? (
          <SummaryTab
            chains={chains}
            uniques={uniques}
            seals={seals}
            level={level}
            axes={attributes}
            onOpen={setTrophy}
          />
        ) : null}
        {active === "misiones" ? <MissionsTab chains={chains} /> : null}
        {active === "trofeos" ? (
          <TrophiesTab uniques={uniques} secrets={secrets} seals={seals} onOpen={setTrophy} />
        ) : null}
        {active === "estadisticas" ? (
          <StatisticsTab
            {...(statisticsData ?? { readerData, informeData, statsScalars, statsRecords })}
          />
        ) : null}
        {active === "rangos" ? <RankLadder level={level} /> : null}
      </div>
      <TrophyDialog
        item={trophy}
        uniques={uniques}
        secrets={secrets}
        onClose={() => setTrophy("")}
      />
    </div>
  );
}
