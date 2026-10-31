import { useId } from "react";
import { Icon } from "@/components/core/Icon/Icon";
import type { DataModel, DataModelEntity } from "@/lib/architecture/data-model/types";
import { updateNavigation, useUrlState } from "@/lib/navigation/useUrlState";
import { COPY } from "./copy.es";
import styles from "./viewer.module.css";

function schemaText(model: DataModel, entity: DataModelEntity): string {
  const fields = entity.attributes.map(
    (attribute) =>
      `  ${attribute.name.padEnd(20)} ${attribute.type}${attribute.optional ? "?" : ""}${attribute.keys?.length ? `  ${attribute.keys.map((key) => ({ PK: "@id", FK: "@foreignKey", UQ: "@unique" })[key]).join(" ")}` : ""}`,
  );
  const groups =
    entity.keyGroups?.map(
      (group) =>
        `  @@${group.kind === "PK" ? "id" : "unique"}([${group.attributes.map((id) => entity.attributes.find((field) => field.id === id)?.name ?? id).join(", ")}])`,
    ) ?? [];
  const relations = model.relationships
    .filter((relation) => relation.from.entity === entity.id)
    .map((relation) => {
      const target = model.entities.find((item) => item.id === relation.to.entity);
      const fields =
        relation.from.attributes
          ?.map((id) => entity.attributes.find((field) => field.id === id)?.name ?? id)
          .join(", ") ?? "";
      const references =
        relation.to.attributes
          ?.map((id) => target?.attributes.find((field) => field.id === id)?.name ?? id)
          .join(", ") ?? "";
      return `  @relation(${JSON.stringify(relation.name ?? relation.id)}, ${target?.name ?? relation.to.entity}, fields: [${fields}], references: [${references}], cardinality: "${relation.from.min}..${relation.from.max === "many" ? "*" : relation.from.max} ↔ ${relation.to.min}..${relation.to.max === "many" ? "*" : relation.to.max}")`;
    });
  return `model ${entity.name} {\n${[...fields, ...groups, ...relations].join("\n")}\n}`;
}

/** A compact schema-style alternative, grouped by entity and read from the same model. */
export function ModelSchema({
  model,
  matches,
  onSelect,
}: {
  model: DataModel;
  matches: readonly string[];
  onSelect: (id: string) => void;
}): React.JSX.Element {
  const group = useId();
  const [selectedTable, setSelectedTable] = useUrlState("schemaTable", "");
  return (
    <div className={`schema-list ${styles.schema}`}>
      {model.entities
        .filter((entity) => matches.includes(entity.id))
        .map((entity) => (
          <details
            key={entity.id}
            name={`${group}-schema`}
            open={selectedTable === entity.id}
            aria-label={entity.name}
            onToggle={(event) => {
              if (event.currentTarget.open && selectedTable !== entity.id) {
                updateNavigation({ schemaTable: entity.id, entity: entity.id, relationship: null });
                onSelect(entity.id);
              } else if (!event.currentTarget.open && selectedTable === entity.id) {
                setSelectedTable("");
              }
            }}
          >
            <summary className={styles.schemaName}>
              <Icon name="chevR" />
              <strong>{entity.name}</strong>
              <span>{COPY.attributeCount(entity.attributes.length)}</span>
            </summary>
            {entity.description && <p>{entity.description}</p>}
            <pre>
              <code>{schemaText(model, entity)}</code>
            </pre>
          </details>
        ))}
    </div>
  );
}
