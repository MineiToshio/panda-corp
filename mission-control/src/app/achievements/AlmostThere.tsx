import { Card, CardHeader } from "@/components/core/Card/Card";
import { ProgressBar } from "@/components/core/ProgressBar/ProgressBar";
import type { ChainState } from "@/lib/achievements/achievements";
import { t } from "@/lib/copy/copy";
import { orderedMissions } from "./_utils/viewRules";

/** The three genuinely progressing chains closest to their next tier. */
export function AlmostThere({ chains }: { chains: readonly ChainState[] }): React.JSX.Element {
  const near = orderedMissions(chains)
    .filter((chain) => chain.nextTier && chain.pctToNext > 0)
    .slice(0, 3);
  return (
    <Card tone="gold">
      <CardHeader title={t("logros.summary.almostThere")} icon="target" />
      {near.length ? (
        near.map((chain) => (
          <div key={chain.statKey}>
            <strong>{chain.nextTier?.name}</strong>
            <p>
              {chain.label} · {chain.value ?? 0}/{chain.nextTier?.threshold}
            </p>
            <ProgressBar tone="gold" done={chain.pctToNext} total={100} ariaLabel={chain.label} />
          </div>
        ))
      ) : (
        <p>{t("logros.summary.noMissionNear")}</p>
      )}
    </Card>
  );
}
