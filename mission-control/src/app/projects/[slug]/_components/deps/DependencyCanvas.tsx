"use client";
import { Button } from "@/components/core/Button/Button";
import { Card, CardHeader } from "@/components/core/Card/Card";
import { Chip } from "@/components/core/Chip/Chip";
import { EmptyState } from "@/components/core/EmptyState/EmptyState";
import { SelectField } from "@/components/core/Field/Field";
import { Segmented } from "@/components/core/Segmented/Segmented";
import { t } from "@/lib/copy/copy";
import { DependencyGraph } from "./DependencyGraph";
import { DependencyList } from "./DependencyList";
import styles from "./DependencyMap.module.css";
import { DependencySide } from "./DependencySide";
import type { DependencyMapData } from "./data";
import { useDependencySelection } from "./useDependencySelection";

/** URL-owned selections over server-computed geometry. Highlighting never recomputes placement. */
export function DependencyCanvas({
  data,
  route = {},
}: {
  data: DependencyMapData;
  route?: { dag?: string; focus?: string; frd?: string };
}): React.JSX.Element {
  const selection = useDependencySelection(data, route);
  const {
    level,
    setDag,
    frd,
    setFrd,
    nodes,
    focus,
    geometry,
    focused,
    handleClear,
    handleFocus,
    handleOpen,
  } = selection;
  if (!data.orders.length)
    return <EmptyState icon="link">{t("workspace.observabilidad.dag.empty")}</EmptyState>;
  return (
    <div className={styles.wrap}>
      <Card tone="teal">
        <CardHeader
          title={t("workspace.observabilidad.dag.title")}
          icon="link"
          action={
            <Chip tone="teal">
              {t(
                level === "wo"
                  ? "workspace.observabilidad.dagOrders.orderCount"
                  : "workspace.observabilidad.dag.frdCount",
                { count: level === "wo" ? nodes.length : data.frdGeometry.boxes.length },
              )}
            </Chip>
          }
        />
        <Segmented
          label={t("workspace.observabilidad.dag.levelsAria")}
          options={[
            { value: "frd", label: t("workspace.observabilidad.dag.levelFrd") },
            { value: "wo", label: t("workspace.observabilidad.dag.levelOrder") },
          ]}
          value={level}
          onChange={setDag}
        />
        {level === "wo" && (
          <div className={styles.toolbar}>
            <SelectField
              label={t("workspace.observabilidad.dagOrders.filterAria")}
              options={[
                { value: "", label: t("workspace.observabilidad.dagOrders.allFrds") },
                ...data.frds
                  .filter((frd) => data.orders.some((order) => order.frd === frd.slug))
                  .map((frd) => ({ value: frd.slug, label: `${frd.code} · ${frd.title}` })),
              ]}
              value={Object.hasOwn(data.workLayouts, frd) ? frd : ""}
              onChange={setFrd}
            />
            {focus && (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                {t("workspace.observabilidad.dagOrders.clearFocus")}
              </Button>
            )}
          </div>
        )}
        <p className={styles.largeNote}>
          {t(
            level === "wo"
              ? "workspace.observabilidad.dagOrders.noteLarge"
              : "workspace.observabilidad.dag.noteLarge",
          )}
        </p>
        <p className={styles.smallNote}>
          {t(
            level === "wo"
              ? "workspace.observabilidad.dagOrders.noteSmall"
              : "workspace.observabilidad.dag.noteSmall",
          )}
        </p>
        <DependencyGraph data={data} selection={selection} />
        <DependencyList
          data={data}
          level={level}
          steps={geometry?.steps ?? []}
          focus={focus}
          onFocus={handleFocus}
          onOpen={handleOpen}
        />
      </Card>
      {level === "wo" && focused && (
        <DependencySide
          order={focused}
          orders={data.orders}
          onFocus={handleFocus}
          onOpen={handleOpen}
        />
      )}
    </div>
  );
}
