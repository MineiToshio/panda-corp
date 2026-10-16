import { parseEntities } from "./parse-entities";
import { parseRelationships } from "./parse-relationships";
import { DATA_MODEL_SOURCE, type DataModelResult } from "./types";
import { DataModelValidationError, invalid, list, object } from "./validation";

/** Validate untrusted JSON into explicit source states without inferring missing architecture. */
export function validateDataModel(raw: unknown): DataModelResult {
  try {
    const value = object(raw, "root", [
      "schemaVersion",
      "persistence",
      "entities",
      "relationships",
    ]);
    if (value.schemaVersion === undefined) return invalid("schemaVersion");
    if (value.schemaVersion !== 1) {
      return { kind: "error", message: "Unsupported data model schemaVersion; expected 1." };
    }
    if (value.persistence === "none") {
      if (
        list(value.entities, "entities", 0).length ||
        list(value.relationships, "relationships", 0).length
      ) {
        return invalid("persistence");
      }
      return { kind: "none" };
    }
    if (value.persistence !== "relational" && value.persistence !== "document")
      return invalid("persistence");
    const entities = parseEntities(value.entities);
    const relationships = parseRelationships(value.relationships, entities);
    return {
      kind: "ready",
      model: { schemaVersion: 1, persistence: value.persistence, entities, relationships },
      source: DATA_MODEL_SOURCE,
    };
  } catch (error) {
    if (error instanceof DataModelValidationError) return { kind: "error", message: error.message };
    throw error;
  }
}
