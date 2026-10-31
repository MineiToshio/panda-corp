import { Card, CardHeader } from "@/components/core/Card/Card";
import { Notice } from "@/components/core/Notice/Notice";
import { t } from "@/lib/copy/copy";
import type { FlightGroupData } from "@/lib/inicio/flight";
import type { InboxError } from "@/lib/inicio/inbox";
import { FlightGroup } from "./FlightGroup";
import styles from "./Home.module.css";
/** In-flight work stays separate from the owner queue; truly empty means no card. */
export function EnMarchaCard({
  groups,
  errors = [],
}: {
  readonly groups: readonly FlightGroupData[];
  readonly errors?: readonly InboxError[];
}): React.JSX.Element | null {
  if (!groups.length && !errors.length) return null;
  return (
    <Card tone="violet">
      <CardHeader
        title={t("inicio.inFlight.title")}
        icon="bolt"
        count={groups.reduce((total, group) => total + group.rows.length, 0)}
      />
      <p className={styles.intro}>{t("inicio.inFlight.intro")}</p>
      {errors.map((error) => (
        <Notice key={`${error.project}:${error.source}`} icon="alert" kind="error">
          {error.project} · {t("inicio.worktrees.unreadable")}
        </Notice>
      ))}
      <div className={styles.stack}>
        {groups.map((group) => (
          <FlightGroup key={group.kind} group={group} />
        ))}
      </div>
    </Card>
  );
}
