import type { DataModelAttribute, DataModelEntity, DataModelKeyGroup } from "./types";
import { invalid, list, object, references, text, uniqueIds } from "./validation";

function parseKeys(raw: unknown, path: string): ("PK" | "FK" | "UQ")[] {
  const keys = list(raw, path, 3).map((key) => {
    if (key !== "PK" && key !== "FK" && key !== "UQ") return invalid(path);
    return key;
  });
  if (new Set(keys).size !== keys.length) return invalid(path);
  return keys;
}

function parseAttribute(raw: unknown, path: string): DataModelAttribute {
  const value = object(raw, path, ["id", "name", "type", "optional", "keys"]);
  if (typeof value.optional !== "boolean") return invalid(`${path}.optional`);
  return {
    id: text(value.id, `${path}.id`, 120),
    name: text(value.name, `${path}.name`),
    type: text(value.type, `${path}.type`, 120),
    optional: value.optional,
    ...(value.keys === undefined ? {} : { keys: parseKeys(value.keys, `${path}.keys`) }),
  };
}

function parseKeyGroups(raw: unknown, entity: DataModelEntity, path: string): DataModelKeyGroup[] {
  const ids = new Set(entity.attributes.map((attribute) => attribute.id));
  const groups = list(raw, path, 100).map((rawGroup): DataModelKeyGroup => {
    const group = object(rawGroup, path, ["kind", "attributes"]);
    if (group.kind !== "PK" && group.kind !== "UQ") return invalid(`${path}.kind`);
    const attributes = references(group.attributes, `${path}.attributes`);
    if (attributes.some((id) => !ids.has(id))) return invalid(`${path}.attributes`);
    return { kind: group.kind, attributes };
  });
  const signatures = groups.map((group) => JSON.stringify([group.kind, group.attributes]));
  if (new Set(signatures).size !== groups.length) return invalid(path);
  if (groups.filter((group) => group.kind === "PK").length > 1) return invalid(path);
  return groups;
}

/** Parse bounded entity definitions and their locally scoped keys. */
export function parseEntities(raw: unknown): DataModelEntity[] {
  const entities = list(raw, "entities", 100).map((rawEntity, index): DataModelEntity => {
    const path = `entities[${index}]`;
    const value = object(rawEntity, path, ["id", "name", "description", "attributes", "keyGroups"]);
    const attributes = list(value.attributes, `${path}.attributes`, 100).map(
      (attribute, attrIndex) => parseAttribute(attribute, `${path}.attributes[${attrIndex}]`),
    );
    uniqueIds(attributes, `${path}.attributes`);
    const entity: DataModelEntity = {
      id: text(value.id, `${path}.id`, 120),
      name: text(value.name, `${path}.name`),
      ...(value.description === undefined
        ? {}
        : { description: text(value.description, `${path}.description`, 4000) }),
      attributes,
    };
    return value.keyGroups === undefined
      ? entity
      : {
          ...entity,
          keyGroups: parseKeyGroups(value.keyGroups, entity, `${path}.keyGroups`),
        };
  });
  uniqueIds(entities, "entities");
  return entities;
}
