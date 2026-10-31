import type { ReportScalars } from "@/lib/achievements/report/types";
import type { ReaderData } from "@/lib/achievements/stats";
import { t } from "@/lib/copy/copy";
import { InformeBands, InformePulse } from "../../Informe/Informe";
import type { InformeData } from "../../Informe/informeData";
import { StatsPanel, type StatsRecords } from "../../StatsPanel";
/** Data seam consumed by the statistics adapter. */
export interface StatisticsData {
  readerData: ReaderData;
  informeData?: InformeData;
  statsScalars?: ReportScalars;
  statsRecords?: StatsRecords;
}
/** Preserve the v1 statistics report until its dedicated work order replaces this adapter. */
export function StatisticsTab({
  readerData,
  informeData,
  statsScalars,
  statsRecords,
}: StatisticsData): React.JSX.Element {
  if (informeData === undefined) {
    return <StatsPanel readerData={readerData} />;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 2px 12px" }}>
        <span
          style={{
            fontFamily: "var(--font-pixel)",
            fontSize: "11px",
            color: "var(--color-accent-text)",
            letterSpacing: ".06em",
          }}
        >
          {t("logros.stats.executive")}
        </span>
        <div style={{ flex: 1, height: "1px", background: "var(--color-border)" }} />
      </div>
      <InformePulse data={informeData} />
      <StatsPanel readerData={readerData} scalars={statsScalars} records={statsRecords} />
      <InformeBands data={informeData} />
    </div>
  );
}
