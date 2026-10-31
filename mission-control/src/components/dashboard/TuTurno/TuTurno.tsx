import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { EmptyState } from "@/components/core/EmptyState/EmptyState";
import { Notice } from "@/components/core/Notice/Notice";
import { t } from "@/lib/copy/copy";
import type { OwnerTurnResult } from "@/lib/inicio/turn";
import { AskRow } from "./AskRow";
import styles from "./TuTurno.module.css";
/** Owner queue with an honest calm state only when every source was readable. */
export function TuTurno({ result }: { readonly result: OwnerTurnResult }): React.JSX.Element {
  const calm = result.count === 0 && result.errors.length === 0;
  return (
    <Card tone="amber">
      <CardHeader
        title={t("inicio.turn.title")}
        icon="target"
        count={calm ? undefined : result.count}
        action={
          calm ? (
            <Chip tone="green" icon="check">
              {t("inicio.turn.upToDate")}
            </Chip>
          ) : undefined
        }
      />
      {result.errors.map((error) => (
        <Notice kind="error" icon="alert" key={`${error.project}:${error.source}`}>
          {error.project} · {t("inicio.worktrees.unreadable")} ·{" "}
          {t(error.source === "decisions" ? "inicio.turn.kindDecision" : "inicio.turn.kindChange")}
        </Notice>
      ))}
      {calm ? <EmptyState icon="check">{t("inicio.turn.empty")}</EmptyState> : null}
      <ul className={`ask-list ${styles.list}`}>
        {result.items.map((item, position) => (
          <AskRow
            key={`${item.projectId}:${item.kind}:${item.id}`}
            item={item}
            position={position}
          />
        ))}
      </ul>
    </Card>
  );
}
