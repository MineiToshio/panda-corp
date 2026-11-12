type Schema = {
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  anyOf?: Schema[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
  items?: Schema;
  minimum?: number;
  maximum?: number;
  pattern?: string;
};
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function matchesType(value: unknown, type: string): boolean {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isObject(value);
  if (type === "integer") return Number.isSafeInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}
function objectError(value: Record<string, unknown>, schema: Schema, at: string): string | null {
  for (const key of schema.required ?? [])
    if (!Object.hasOwn(value, key)) return `${at}.${key}: campo obligatorio`;
  for (const [key, child] of Object.entries(value)) {
    const rule = schema.properties?.[key] ?? schema.additionalProperties;
    if (rule === false) return `${at}.${key}: campo desconocido`;
    if (typeof rule !== "object") continue;
    const error = schemaError(child, rule, `${at}.${key}`);
    if (error) return error;
  }
  return null;
}
function scalarError(value: unknown, schema: Schema, at: string): string | null {
  if (schema.anyOf && !schema.anyOf.some((s) => schemaError(value, s, at) === null))
    return `${at}: variante inválida`;
  if (Object.hasOwn(schema, "const") && value !== schema.const) return `${at}: valor inválido`;
  if (schema.enum && !schema.enum.includes(value)) return `${at}: valor fuera del catálogo`;
  const types = typeof schema.type === "string" ? [schema.type] : schema.type;
  if (types && !types.some((t) => matchesType(value, t))) return `${at}: tipo inválido`;
  return null;
}
function rangeError(value: unknown, schema: Schema, at: string): string | null {
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) return `${at}: inferior al mínimo`;
    if (schema.maximum !== undefined && value > schema.maximum) return `${at}: superior al máximo`;
  }
  if (typeof value === "string" && schema.pattern && !new RegExp(schema.pattern).test(value))
    return `${at}: formato inválido`;
  return null;
}
/** Validate the producer's JSON-schema subset without importing or executing engine modules. */
export function schemaError(value: unknown, schema: Schema, at = "$ modelo"): string | null {
  const error = scalarError(value, schema, at) ?? rangeError(value, schema, at);
  if (error) return error;
  if (Array.isArray(value) && schema.items) {
    for (const [i, child] of value.entries()) {
      const issue = schemaError(child, schema.items, `${at}[${i}]`);
      if (issue) return issue;
    }
  }
  return isObject(value) ? objectError(value, schema, at) : null;
}
