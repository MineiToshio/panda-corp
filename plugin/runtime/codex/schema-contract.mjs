export function assertStrictStructuredOutputSchema(schema, location = "$") {
  if (!schema || typeof schema !== "object") throw new Error(`${location} must be a schema object`);
  if (schema.type === "object" || schema.properties) {
    if (schema.type !== "object" || schema.additionalProperties !== false || !schema.properties || typeof schema.properties !== "object" || Array.isArray(schema.properties)) throw new Error(`${location} object must declare properties and additionalProperties=false`);
    const properties = Object.keys(schema.properties).sort();
    const required = Array.isArray(schema.required) ? [...schema.required].sort() : [];
    if (JSON.stringify(properties) !== JSON.stringify(required)) throw new Error(`${location} properties must all be required`);
    for (const [key, child] of Object.entries(schema.properties)) assertStrictStructuredOutputSchema(child, `${location}.properties.${key}`);
  }
  if (schema.type === "array" && schema.items) assertStrictStructuredOutputSchema(schema.items, `${location}.items`);
  return schema;
}
