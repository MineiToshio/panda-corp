import type { DataModel, DataModelRelationship } from "@/lib/architecture/data-model/types";
import { COPY } from "./copy.es";
import styles from "./viewer.module.css";

/** A selected entity or relation; the viewer itself never changes the source model. */
export type ModelSelection = { kind: "entity" | "relationship"; id: string } | null;

function relationLabel(model: DataModel, relation: DataModelRelationship) {
  const from =
    model.entities.find((entity) => entity.id === relation.from.entity)?.name ??
    relation.from.entity;
  const to =
    model.entities.find((entity) => entity.id === relation.to.entity)?.name ?? relation.to.entity;
  return `${from} ↔ ${to}${relation.name ? ` · ${relation.name}` : ""}`;
}

function fieldMapping(model: DataModel, relation: DataModelRelationship) {
  return [relation.from, relation.to]
    .map((endpoint) => {
      const entity = model.entities.find((item) => item.id === endpoint.entity);
      const fields = endpoint.attributes?.map(
        (id) => entity?.attributes.find((attribute) => attribute.id === id)?.name ?? id,
      );
      return `${entity?.name ?? endpoint.entity}${fields?.length ? ` (${fields.join(", ")})` : ""}`;
    })
    .join(" → ");
}

/** Plain-language explanations in both directions and exact mapped fields. */
export function ModelInspector({
  model,
  selection,
  onSelect,
}: {
  model: DataModel;
  selection: ModelSelection;
  onSelect: (selection: ModelSelection) => void;
}): React.JSX.Element {
  const entity =
    selection?.kind === "entity"
      ? model.entities.find((item) => item.id === selection.id)
      : undefined;
  const relation =
    selection?.kind === "relationship"
      ? model.relationships.find((item) => item.id === selection.id)
      : undefined;
  const relations = entity
    ? model.relationships.filter(
        (item) => item.from.entity === entity.id || item.to.entity === entity.id,
      )
    : model.relationships;
  const from = model.entities.find((item) => item.id === relation?.from.entity)?.name ?? "";
  const to = model.entities.find((item) => item.id === relation?.to.entity)?.name ?? "";
  return (
    <aside className={styles.inspector} aria-label={COPY.relationships}>
      {!selection && <p className={styles.muted}>{COPY.inspect}</p>}
      {entity && (
        <>
          <strong>{entity.name}</strong>
          {entity.description && <p>{entity.description}</p>}
        </>
      )}
      {relation && (
        <div className={styles.relationDetail}>
          <strong>{relationLabel(model, relation)}</strong>
          {relation.description && <p>{relation.description}</p>}
          <p>{COPY.direction(from, to, COPY.endpoint(relation.to.min, relation.to.max))}</p>
          <p>{COPY.direction(to, from, COPY.endpoint(relation.from.min, relation.from.max))}</p>
          <code>{fieldMapping(model, relation)}</code>
        </div>
      )}
      {relations.length === 0 && <p className={styles.muted}>{COPY.noRelationships}</p>}
      <div className={styles.relationList}>
        {relations.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => onSelect({ kind: "relationship", id: item.id })}
            aria-pressed={relation?.id === item.id}
            aria-label={`${COPY.relation} ${relationLabel(model, item)}`}
          >
            {relationLabel(model, item)}{" "}
            <span>
              {item.from.min}..{item.from.max === "many" ? "*" : item.from.max} ↔ {item.to.min}..
              {item.to.max === "many" ? "*" : item.to.max}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
