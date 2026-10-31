import { Suspense } from "react";
import { PluginSyncBanner } from "@/app/_components/plugin-sync-banner/plugin-sync-banner";
import styles from "@/app/(dashboard)/_components/Home.module.css";
import {
  FlightSection,
  FunnelSection,
  GuildSection,
  PortfolioSection,
  PulseSection,
  TurnSection,
  WorktreesSection,
} from "@/app/(dashboard)/_components/HomeSections";
import { PageHead } from "@/components/core/PageHead/PageHead";
import { DashboardLiveWatcher } from "@/components/dashboard/DashboardLiveWatcher/DashboardLiveWatcher";
import { t } from "@/lib/copy/copy";
/** Read-only command center; each slow read streams independently under the shell's main. */
export default function HomePage(): React.JSX.Element {
  return (
    <div data-testid="dashboard-page">
      <PageHead title={t("inicio.title")} subtitle={t("inicio.subtitle")} />
      <DashboardLiveWatcher />
      <PluginSyncBanner />
      <div className={`home-grid ${styles.grid}`}>
        <div className={styles.column}>
          <Suspense fallback={null}>
            <TurnSection />
          </Suspense>
          <Suspense fallback={null}>
            <PortfolioSection />
          </Suspense>
          <Suspense fallback={null}>
            <FlightSection />
          </Suspense>
        </div>
        <div className={styles.column}>
          <Suspense fallback={null}>
            <PulseSection />
          </Suspense>
          <Suspense fallback={null}>
            <GuildSection />
          </Suspense>
          <Suspense fallback={null}>
            <FunnelSection />
          </Suspense>
          <Suspense fallback={null}>
            <WorktreesSection />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
