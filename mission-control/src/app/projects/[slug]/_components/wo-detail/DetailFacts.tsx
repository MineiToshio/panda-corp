import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { statePresentation } from "@/components/core/Chip/vocabulary";
import { CmdRow } from "@/components/core/CmdRow/CmdRow";
import { KeyValue } from "@/components/core/KeyValue/KeyValue";
import { t } from "@/lib/copy/copy";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { DependencyButton } from "./DependencyButton";
import styles from "./detail.module.css";

const DIFFICULTIES = ["trivial", "low", "normal", "medium", "high"] as const;
/** Document facts and the upstream/downstream links derived by the shared reader. */
export function DetailFacts({
  order,
  orders,
  dependents,
  href,
}: {
  order: WorkOrder;
  orders: readonly WorkOrder[];
  dependents: readonly WorkOrder[];
  href: string;
}): React.JSX.Element {
  const meta = statePresentation(order.state === "fail" ? "blocked" : order.state);
  const difficulty = DIFFICULTIES.find((value) => value === order.difficulty);
  const items = [
    {
      id: "state",
      label: t("workspace.observabilidad.detail.sheet.state"),
      value: (
        <Chip tone={meta.tone} icon={meta.icon}>
          {t(meta.labelKey)}
        </Chip>
      ),
    },
    {
      id: "difficulty",
      label: t("workspace.observabilidad.detail.sheet.difficulty"),
      value: difficulty
        ? t(`workspace.observabilidad.difficulty.${difficulty}`)
        : (order.difficulty ?? "·"),
    },
    {
      id: "reopen",
      label: t("workspace.observabilidad.detail.sheet.reopenings"),
      value: order.reopenCount || t("workspace.observabilidad.detail.sheet.reopeningsNone"),
    },
    {
      id: "updated",
      label: t("workspace.observabilidad.detail.sheet.updated"),
      value: order.lastUpdated ?? "·",
    },
    {
      id: "requirements",
      label: t("workspace.observabilidad.detail.sheet.requirements"),
      value: (
        <div className={styles.chips}>
          {order.requirements?.map((id) => (
            <Chip tone="blue" key={id} variant="outline">
              {id}
            </Chip>
          ))}
        </div>
      ),
    },
    ...(order.blockedReason
      ? [
          {
            id: "blocker",
            label: t("workspace.observabilidad.detail.sheet.blocker"),
            value: order.blockedReason,
          },
        ]
      : []),
  ];
  return (
    <aside className={styles.side}>
      <Card>
        <CardHeader title={t("workspace.observabilidad.detail.sheet.title")} icon="file" />
        <KeyValue items={items} />
        <h3>{t("workspace.observabilidad.detail.sheet.files")}</h3>
        <ul className={`wo-files ${styles.files}`}>
          {order.artifacts?.map((file) => (
            <li key={file}>
              <code>{file}</code>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <CardHeader title={t("workspace.observabilidad.detail.dependencies.title")} icon="link" />
        {(["dependsOn", "unlocks"] as const).map((key) => {
          const ids =
            key === "dependsOn" ? (order.dependsOn ?? []) : dependents.map((item) => item.id);
          return (
            <div key={key}>
              <h3>{t(`workspace.observabilidad.detail.dependencies.${key}`)}</h3>
              <div className={styles.chips}>
                {ids.length
                  ? ids.map((id) => (
                      <DependencyButton
                        key={id}
                        order={orders.find((item) => item.id === id) ?? { id }}
                        href={href}
                      />
                    ))
                  : t("workspace.observabilidad.detail.dependencies.none")}
              </div>
            </div>
          );
        })}
      </Card>
      <Card tone="violet">
        <CardHeader title={t("workspace.observabilidad.detail.build.title")} icon="terminal" />
        <CmdRow variant="box" command={`/pandacorp:implement ${order.id}`} />
      </Card>
    </aside>
  );
}
