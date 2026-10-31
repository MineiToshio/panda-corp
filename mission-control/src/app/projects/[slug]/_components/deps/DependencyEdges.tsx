import { t } from "@/lib/copy/copy";
import type { WorkOrderGeometry } from "@/lib/deps-layout/types";
import styles from "./DependencyMap.module.css";
import type { DependencyMapData } from "./data";
/** SVG curves carry no layout state: chain toggles only change presentation classes. */
export function DependencyEdges({
  data,
  level,
  geometry,
  active,
  lit,
}: {
  data: DependencyMapData;
  level: string;
  geometry: WorkOrderGeometry | undefined;
  active: string;
  lit: ReadonlySet<string>;
}): React.JSX.Element {
  const frd = level === "frd",
    width = frd ? data.frdGeometry.width : geometry?.width,
    height = frd ? data.frdGeometry.height : geometry?.height;
  const edges = frd ? data.frdGeometry.edges : (geometry?.edges ?? []);
  return (
    <svg className={styles.edges} width={width} height={height} aria-hidden="true">
      {edges.map((edge) => (
        <path
          key={`${edge.from}:${edge.to}`}
          className={`dag-edge ${styles.edge}`}
          d={edge.path}
          data-chain={active ? (lit.has(edge.from) && lit.has(edge.to) ? "on" : "dim") : undefined}
        />
      ))}
      {frd &&
        data.frdGeometry.links.map((link) => {
          const from = data.frds.find((frd) => frd.slug === link.from)?.code ?? link.from,
            to = data.frds.find((frd) => frd.slug === link.to)?.code ?? link.to;
          const title =
            t("workspace.observabilidad.dag.linkTitle", { from, to, count: link.count }) +
            (link.backCount
              ? t("workspace.observabilidad.dag.linkBack", { count: link.backCount })
              : "");
          return (
            <g key={`${link.from}:${link.to}`}>
              <path
                className={`fdag-link ${styles.frdLink}`}
                style={{ strokeWidth: Math.min(8, 1.5 + link.count / 2) }}
                d={link.path}
              >
                <title>{title}</title>
              </path>
              <text
                className={`fdag-n ${styles.label}`}
                x={link.labelX}
                y={link.labelY}
                textAnchor="middle"
              >
                {link.count}
                {link.backCount ? ` ⇄ ${link.backCount}` : ""}
              </text>
            </g>
          );
        })}
    </svg>
  );
}
