// Stable failure identity shared by ordinary recovery, rescue transport and exclusion.
const clean = text => String(text ?? "").replace(/\s+/g, " ").slice(0, 1200);
/** Same class AND same unit/file, independent of attempt, error prose or coordinator epoch. */
export function failureIdentity(unit, failure) {
  const files = [...new Set(failure.files ?? clean(failure.detail).match(/(?:[\w@.\-[\]]+\/)+[\w.\-[\]]+/g) ?? [])].sort();
  return JSON.stringify([failure.code ?? failure.cause ?? "no_progress", unit.id, files, ...(failure.worker ? [failure.worker] : [])]);
}
