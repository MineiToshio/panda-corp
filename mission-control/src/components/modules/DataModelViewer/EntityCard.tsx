import { memo } from "react";
import type { DataModelEntity } from "@/lib/architecture/data-model/types";
import { COPY } from "./copy.es";
import { entityGeometry } from "./entityGeometry";
import type { ModelNode } from "./layout";
import styles from "./viewer.module.css";

/** Compact field-level ERD card; every field remains available at the default scale. */
function EntityCardContent({
  node,
  selected,
  related,
  matching,
  onSelect,
}: {
  node: ModelNode;
  selected: boolean;
  related: boolean;
  matching: boolean;
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const entity = node.entity;
  const [nameWidth, typeWidth, keyWidth, optionalWidth] = entityGeometry(entity).columns;
  return (
    <section
      className={styles.entity}
      style={{ left: node.x, top: node.y, width: node.width }}
      data-selected={selected}
      data-related={related}
      data-match={matching}
      aria-label={entity.name}
    >
      <button
        type="button"
        className={styles.entityHead}
        data-model-interactive="true"
        aria-label={`${COPY.select} ${entity.name}`}
        aria-pressed={selected}
        onClick={() => onSelect(entity.id)}
      >
        <strong title={entity.name}>{entity.name}</strong>
        <span>{entity.attributes.length}</span>
      </button>
      <table aria-label={`${COPY.fields} ${entity.name}`}>
        <colgroup>
          <col style={{ width: nameWidth }} />
          <col style={{ width: typeWidth }} />
          <col style={{ width: keyWidth }} />
          <col style={{ width: optionalWidth }} />
        </colgroup>
        <thead className={styles.srOnly}>
          <tr>
            <th>{COPY.fields}</th>
            <th>{COPY.type}</th>
            <th>{COPY.keys}</th>
            <th>{COPY.value}</th>
          </tr>
        </thead>
        <tbody>
          {entity.attributes.map((attribute) => (
            <tr key={attribute.id}>
              <td title={attribute.name}>{attribute.name}</td>
              <td title={attribute.type}>{attribute.type}</td>
              <td>{fieldKeys(entity, attribute.id).join(" ")}</td>
              <td
                title={attribute.optional ? COPY.optional : COPY.required}
                aria-label={attribute.optional ? COPY.optional : COPY.required}
              >
                {attribute.optional ? "?" : "●"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Include composite keys at their fields instead of silently dropping group constraints. */
function fieldKeys(entity: DataModelEntity, id: string): string[] {
  const field = entity.attributes.find((attribute) => attribute.id === id);
  return [
    ...new Set([
      ...(field?.keys ?? []),
      ...(entity.keyGroups
        ?.filter((group) => group.attributes.includes(id))
        .map((group) => group.kind) ?? []),
    ]),
  ];
}

/** Stable geometry/selection props avoid rebuilding field tables while only the camera moves. */
export const EntityCard = memo(EntityCardContent);
