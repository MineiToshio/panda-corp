import type { DataModelEndpoint, DataModelEntity, DataModelRelationship } from "./types";
import { invalid, list, object, references, text, uniqueIds } from "./validation";

function parseEndpoint(
  raw: unknown,
  entities: readonly DataModelEntity[],
  path: string,
): DataModelEndpoint {
  const value = object(raw, path, ["entity", "attributes", "min", "max"]);
  const entity = entities.find((candidate) => candidate.id === value.entity);
  if (!entity) return invalid(`${path}.entity`);
  if (value.min !== 0 && value.min !== 1) return invalid(`${path}.min`);
  if (value.max !== 1 && value.max !== "many") return invalid(`${path}.max`);
  const attributes =
    value.attributes === undefined ? undefined : references(value.attributes, `${path}.attributes`);
  if (attributes?.some((id) => !entity.attributes.some((attribute) => attribute.id === id))) {
    return invalid(`${path}.attributes`);
  }
  return {
    entity: entity.id,
    min: value.min,
    max: value.max,
    ...(attributes ? { attributes } : {}),
  };
}

/** Resolve every endpoint and preserve parallel/self edges without guessing omitted mappings. */
export function parseRelationships(
  raw: unknown,
  entities: readonly DataModelEntity[],
): DataModelRelationship[] {
  const relationships = list(raw, "relationships", 400).map(
    (rawRelationship, index): DataModelRelationship => {
      const path = `relationships[${index}]`;
      const value = object(rawRelationship, path, ["id", "name", "description", "from", "to"]);
      const from = parseEndpoint(value.from, entities, `${path}.from`);
      const to = parseEndpoint(value.to, entities, `${path}.to`);
      if (from.attributes?.length !== to.attributes?.length) return invalid(`${path}.attributes`);
      return {
        id: text(value.id, `${path}.id`, 120),
        ...(value.name === undefined ? {} : { name: text(value.name, `${path}.name`) }),
        ...(value.description === undefined
          ? {}
          : { description: text(value.description, `${path}.description`, 4000) }),
        from,
        to,
      };
    },
  );
  uniqueIds(relationships, "relationships");
  return relationships;
}
