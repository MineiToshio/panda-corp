/** Schema failures contain field locations only, never untrusted values or file paths. */
export class DataModelValidationError extends Error {}

/** Reject malformed fields at the boundary instead of coercing them into empty values. */
export function invalid(path: string): never {
  throw new DataModelValidationError(`Invalid data model at ${path}.`);
}

/** Narrow an object and reject unknown fields so misspelled contract keys fail loudly. */
export function object(
  raw: unknown,
  path: string,
  allowed: readonly string[],
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return invalid(path);
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some((key) => !allowed.includes(key))) return invalid(path);
  return value;
}

/** Require bounded nonblank text without changing a project-authored display value. */
export function text(raw: unknown, path: string, limit = 200): string {
  if (typeof raw !== "string" || !raw.trim() || raw.length > limit) return invalid(path);
  return raw;
}

/** Bound each collection before iterating its members. */
export function list(raw: unknown, path: string, limit: number): unknown[] {
  if (!Array.isArray(raw) || raw.length > limit) return invalid(path);
  return raw;
}

/** Parse nonempty, duplicate-free references used by composite mappings and keys. */
export function references(raw: unknown, path: string): string[] {
  const values = list(raw, path, 100).map((value) => text(value, path, 120));
  if (!values.length || new Set(values).size !== values.length) return invalid(path);
  return values;
}

/** Require unique stable IDs within a scope. */
export function uniqueIds(values: readonly { readonly id: string }[], path: string): void {
  if (new Set(values.map((value) => value.id)).size !== values.length) invalid(path);
}
