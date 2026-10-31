import Link from "next/link";
import { Card, CardFoot, CardHeader } from "@/components/core/Card/Card";
import { Icon } from "@/components/core/Icon/Icon";
import { t } from "@/lib/copy/copy";
import type { FunnelData } from "@/lib/inicio/funnel";
import { FunnelRow } from "./FunnelRow";
import styles from "./Home.module.css";
/** Phase funnel with discarded ideas kept outside the active pipeline. */
export function EmbudoCard({ funnel }: { readonly funnel: FunnelData }): React.JSX.Element {
  const max = Math.max(0, ...funnel.rows.map((row) => row.count));
  return (
    <Card tone="teal">
      <CardHeader title={t("inicio.funnel.title")} icon="kanban" />
      <div className={`funnel ${styles.funnel}`}>
        {funnel.rows.map((row) => (
          <FunnelRow key={row.phase} {...row} max={max} />
        ))}
      </div>
      <CardFoot>
        <span className="small faint">
          {t("inicio.funnel.discarded", { count: funnel.discarded })}
        </span>
        <Link className="link" data-tone="teal" href="/board">
          {t("inicio.funnel.openBoard")} <Icon name="arrow" size="sm" />
        </Link>
      </CardFoot>
    </Card>
  );
}
