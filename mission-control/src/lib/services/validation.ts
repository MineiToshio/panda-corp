/** Boundary helpers reject malformed data without exposing its raw value. */
export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("invalid-object");
  return Object.fromEntries(Object.entries(value));
}
/** Required bounded text, excluding control characters. */
export function text(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > 12000 ||
    Array.from(value).some((character) => character.charCodeAt(0) < 9)
  )
    throw new Error("invalid-text");
  return value;
}
/** Nullable text preserves unknown identities explicitly. */
export function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}
/** Canonical identifiers cannot traverse paths. */
export function identifier(value: unknown): string {
  const result = text(value);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(result)) throw new Error("invalid-id");
  return result;
}
/** All lists must be represented explicitly. */
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("invalid-list");
  return value;
}
/** Fail closed for non-boolean budget/account flags. */
export function boolean(value: unknown): boolean {
  if (typeof value !== "boolean") throw new Error("invalid-boolean");
  return value;
}
/** Enum parser never silently upgrades an unknown state. */
export function choice(value: unknown, allowed: readonly string[]): string {
  const result = text(value);
  if (!allowed.includes(result)) throw new Error("invalid-state");
  return result;
}
/** HTTPS dashboard links allow only stable, non-secret project query selectors. */
export function safeServiceUrl(value: unknown): string {
  const url = new URL(text(value));
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw new Error("invalid-url");
  for (const [key, val] of url.searchParams) {
    if (key !== "project" || !/^[a-zA-Z0-9_-]+$/.test(val)) throw new Error("unsafe-query");
  }
  return url.href;
}
/** Dated observations remain distinct from live verification. */
export function date(value: unknown): string | null {
  const result = nullableText(value);
  if (result) {
    if (!/^\d{4}-\d{2}-\d{2}(?:T.+)?$/.test(result) || !Number.isFinite(Date.parse(result)))
      throw new Error("invalid-date");
    const dateOnly = result.slice(0, 10);
    if (new Date(`${dateOnly}T00:00:00Z`).toISOString().slice(0, 10) !== dateOnly)
      throw new Error("invalid-calendar-date");
  }
  return result;
}
/** Every registry has an explicit version to avoid silent schema drift. */
export function versioned(value: unknown): Record<string, unknown> {
  const result = record(value);
  if (result.schema_version !== 1) throw new Error("invalid-version");
  return result;
}
/** Duplicate identities cannot ambiguously join records. */
export function unique<T>(values: T[], key: (value: T) => string): T[] {
  if (new Set(values.map(key)).size !== values.length) throw new Error("duplicate-id");
  return values;
}

/** Public documentation accepts stable locale selectors as well as safe section anchors. */
export function safeSourceUrl(value: unknown): string {
  const url = new URL(text(value));
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("invalid-source-url");
  for (const [key, val] of url.searchParams)
    if (!["project", "hl"].includes(key) || !/^[a-zA-Z0-9_-]+$/.test(val))
      throw new Error("unsafe-source-query");
  return url.href;
}

/** Public recipes must contain evidence and a concrete automation path. */
export function nonEmptyList(value: unknown): unknown[] {
  const result = list(value);
  if (!result.length) throw new Error("empty-list");
  return result;
}
