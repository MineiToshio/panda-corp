import Link from "next/link";
import { Card, CardFoot, CardHeader } from "@/components/core/Card/Card";
import { t } from "@/lib/copy/copy";
import type { FunnelData } from "@/lib/inicio/funnel";
import { FunnelRow } from "./FunnelRow";
import styles from "./Home.module.css";
/** Phase funnel with discarded ideas kept outside the active pipeline. */
export function EmbudoCard({ funnel }: { readonly funnel: FunnelData }): React.JSX.Element {
  const max = Math.max(0, ...funnel.rows.map((row) => row.count));
  return (
    <Card tone="teal">
      <CardHeader title={t("inicio.funnel.title")} icon="chart" />
      <div className={`funnel ${styles.funnel}`}>
        {funnel.rows.map((row) => (
          <FunnelRow key={row.phase} {...row} max={max} />
        ))}
      </div>
      <CardFoot>
        <span>{t("inicio.funnel.discarded", { count: funnel.discarded })}</span>
        <Link href="/board">{t("inicio.funnel.openBoard")}</Link>
      </CardFoot>
    </Card>
  );
}
