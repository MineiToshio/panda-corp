import type { ReportScalars } from "@/lib/achievements/report/types";
import type { ReaderData } from "@/lib/achievements/stats";
import type { EventSourceHealth } from "@/lib/events/eventSourceHealth";
import { InformeBands, InformePulse } from "../../Informe/Informe";
import type { InformeData } from "../../Informe/informeData";
import { CharacterSheet } from "./CharacterSheet";
import styles from "./Stats.module.css";
import type { StatsRecords } from "./types";

/** Serializable statistics seam; all source access belongs to the cached server loader. */
export interface StatisticsData {
  readonly readerData: ReaderData;
  readonly informeData?: InformeData;
  readonly statsScalars?: ReportScalars;
  readonly statsRecords?: StatsRecords;
  readonly usageHealth?: EventSourceHealth;
  readonly counterKinds?: readonly string[];
}
/** Operator report, interleaved with the engine-derived character sheet. */
export function StatisticsTab({
  readerData,
  informeData,
  statsScalars,
  statsRecords,
  usageHealth,
  counterKinds,
}: StatisticsData): React.JSX.Element {
  return (
    <div className={styles.report} data-testid="informe-report">
      {informeData ? <InformePulse data={informeData} /> : null}
      <CharacterSheet
        readerData={readerData}
        scalars={statsScalars}
        records={statsRecords}
        counterKinds={counterKinds}
      />
      {informeData ? <InformeBands data={informeData} usageHealth={usageHealth} /> : null}
    </div>
  );
}
