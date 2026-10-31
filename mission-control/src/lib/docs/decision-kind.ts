/** Identify timestamp-prefixed technical log entries without server dependencies. */
export function isEngineLogEntry(point: { readonly title: string }): boolean {
  return /^(?:T?\d{1,2}:\d{2}\b|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}\b)/.test(point.title);
}
