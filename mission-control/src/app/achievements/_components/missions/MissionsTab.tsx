import { SectionHead } from "@/components/core/SectionHead/SectionHead";
import type { ChainState } from "@/lib/achievements/achievements";
import { SAGA_ICONS, SAGA_ORDER } from "@/lib/achievements/definitions";
import { t } from "@/lib/copy/copy";
import { orderedMissions } from "../../_utils/viewRules";
import { MissionCard } from "./MissionCard";
import styles from "./missions.module.css";

/** Saga sections ordered by proximity to the next tier, with untouched missions last. */
export function MissionsTab({ chains }: { chains: readonly ChainState[] }): React.JSX.Element {
  const ordered = orderedMissions(chains);
  const spot = ordered.find((chain) => chain.nextTier !== null && chain.pctToNext > 0);
  return (
    <div className={styles.stack}>
      <p className={styles.muted}>{t("logros.missions.intro")}</p>
      {spot ? <MissionCard chain={spot} spot /> : null}
      {SAGA_ORDER.map((saga) => {
        const group = ordered.filter((chain) => chain.saga === saga);
        return group.length ? (
          <section key={saga} aria-label={saga}>
            <SectionHead
              label={saga}
              icon={SAGA_ICONS[saga]}
              note={t("logros.missions.count", { count: group.length })}
            />
            <div className={styles.grid}>
              {group.map((chain) => (
                <MissionCard key={chain.statKey} chain={chain} />
              ))}
            </div>
          </section>
        ) : null;
      })}
    </div>
  );
}
