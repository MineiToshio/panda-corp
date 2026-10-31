import { Card, CardHeader } from "@/components/core/Card/Card";
import { t } from "@/lib/copy/copy";
import type { PulseTile } from "@/lib/inicio/pulse";
import styles from "./Pulso.module.css";
/** At most five factory signals, with unknown counts visibly distinct from zero. */
export function Pulso({ tiles }: { readonly tiles: readonly PulseTile[] }): React.JSX.Element {
  return (
    <Card tone="teal">
      <CardHeader title={t("inicio.pulse.title")} icon="activity" />
      <dl className={`pulse ${styles.pulse}`}>
        {tiles.map((tile) => (
          <div key={tile.label}>
            <dd className={`num ${styles.number}`}>{tile.value ?? "?"}</dd>
            <dt>{tile.label}</dt>
          </div>
        ))}
      </dl>
    </Card>
  );
}
