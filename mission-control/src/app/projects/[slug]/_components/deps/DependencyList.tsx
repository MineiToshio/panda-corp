import { Chip } from "@/components/core/Chip/Chip";
import { t } from "@/lib/copy/copy";
import styles from "./DependencyMap.module.css";
import { DependencyNode } from "./DependencyNode";
import type { DependencyMapData } from "./data";
/** Ordered FRD or work-order build list, displayed below the canvas breakpoint. */
export function DependencyList({
  data,
  level,
  steps,
  focus,
  onFocus,
  onOpen,
}: {
  data: DependencyMapData;
  level: string;
  steps: readonly string[][];
  focus: string;
  onFocus: (id: string) => void;
  onOpen: (id: string) => void;
}): React.JSX.Element {
  const byId = new Map(data.orders.map((order) => [order.id, order]));
  if (level === "wo")
    return (
      <ol className={`dag-list ${styles.list}`}>
        {steps.map((ids, index) => (
          <li key={ids.join(",")}>
            <h3>
              {t("workspace.observabilidad.dagOrders.step", {
                index: index + 1,
                count: ids.length,
              })}
            </h3>
            {ids.map((id) => {
              const order = byId.get(id);
              return order ? (
                <DependencyNode
                  key={id}
                  order={order}
                  focus={focus === id}
                  onActivate={() => onFocus(id)}
                />
              ) : null;
            })}
          </li>
        ))}
      </ol>
    );
  return (
    <ol className={`dag-list ${styles.list}`}>
      {data.frdGeometry.boxes.map((box) => {
        const frd = data.frds.find((frd) => frd.slug === box.slug);
        if (!frd) return null;
        const orders = data.orders.filter((order) => order.frd === box.slug);
        return (
          <li key={box.slug}>
            <details className="dl-frd">
              <summary>
                <Chip tone="violet">{frd.code}</Chip>
                <b>{frd.title}</b>
                <span>
                  {t("workspace.observabilidad.dag.verified", {
                    done: orders.filter((order) => order.state === "done").length,
                    total: orders.length,
                  })}
                </span>
              </summary>
              {["before", "after"].map((direction) => {
                const links = data.frdGeometry.links.filter((link) =>
                  direction === "before" ? link.to === box.slug : link.from === box.slug,
                );
                return (
                  <div key={direction}>
                    <h3>
                      {t(
                        direction === "before"
                          ? "workspace.observabilidad.dag.dependsOn"
                          : "workspace.observabilidad.dag.unlocks",
                      )}
                    </h3>
                    {links.length ? (
                      links.map((link) => (
                        <Chip key={`${link.from}:${link.to}`} tone="violet">
                          {
                            data.frds.find(
                              (frd) => frd.slug === (direction === "before" ? link.from : link.to),
                            )?.code
                          }
                          {link.count > 1 ? ` · ${link.count}` : ""}
                        </Chip>
                      ))
                    ) : (
                      <p>
                        {t(
                          direction === "before"
                            ? "workspace.observabilidad.dag.startingPoint"
                            : "workspace.observabilidad.dag.nothing",
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
              {box.ids.map((id) => {
                const order = byId.get(id);
                return order ? (
                  <DependencyNode key={id} order={order} onActivate={() => onOpen(id)} />
                ) : null;
              })}
            </details>
          </li>
        );
      })}
    </ol>
  );
}
