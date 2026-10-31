import { t } from "@/lib/copy/copy";
import { DependencyEdges } from "./DependencyEdges";
import { DependencyFrdBox } from "./DependencyFrdBox";
import styles from "./DependencyMap.module.css";
import { DependencyNode } from "./DependencyNode";
import type { DependencyMapData } from "./data";
import type { DependencySelection } from "./useDependencySelection";
/** Bounded, naturally sized graph. Only chain classes vary on interaction. */
export function DependencyGraph({
  data,
  selection,
}: {
  data: DependencyMapData;
  selection: DependencySelection;
}): React.JSX.Element {
  const {
    level,
    geometry,
    nodes,
    active,
    lit,
    byId,
    focus,
    handleFrd,
    handleOpen,
    handleFocus,
    handleBackground,
    setHover,
  } = selection;
  const width = level === "wo" ? (geometry?.width ?? 0) : data.frdGeometry.width,
    height = level === "wo" ? (geometry?.height ?? 0) : data.frdGeometry.height;
  function handleKey(event: React.KeyboardEvent<HTMLElement>): void {
    if (event.key === "Escape") selection.handleClear();
  }
  return (
    <section
      className={`dag ${styles.region}`}
      aria-label={t(
        level === "wo"
          ? "workspace.observabilidad.dagOrders.regionAria"
          : "workspace.observabilidad.dag.regionAria",
      )}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: natural-size canvas requires keyboard scrolling.
      tabIndex={0}
      onClick={handleBackground}
      onKeyDown={handleKey}
    >
      <div className={`dag-canvas ${styles.canvas}`} style={{ width, height }}>
        <DependencyEdges data={data} level={level} geometry={geometry} active={active} lit={lit} />
        {level === "frd" &&
          data.frdGeometry.boxes.map((box) => {
            const frd = data.frds.find((frd) => frd.slug === box.slug);
            return frd ? (
              <DependencyFrdBox
                key={box.slug}
                box={box}
                frd={frd}
                orders={data.orders.filter((order) => order.frd === frd.slug)}
                onOpen={() => handleFrd(box.slug)}
              />
            ) : null;
          })}
        {nodes.map((position) => {
          const order = byId.get(position.id);
          return order ? (
            <DependencyNode
              key={order.id}
              order={order}
              position={position}
              mini={level === "frd"}
              focus={order.id === focus}
              chain={active ? (lit.has(order.id) ? "on" : "dim") : undefined}
              onActivate={() => (level === "frd" ? handleOpen(order.id) : handleFocus(order.id))}
              onHover={level === "wo" ? setHover : undefined}
            />
          ) : null;
        })}
      </div>
    </section>
  );
}
