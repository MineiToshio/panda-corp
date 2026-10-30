/** Server-only clock contract: clients receive an ISO prop, never call this or Date.now for displayed ages. */
/** Invalid frozen-clock configuration; never falls back to owner wall time. */
export class ClockConfigError extends Error {
  constructor() {
    super("MC_CLOCK must be a valid ISO-8601 instant with a timezone");
    this.name = "ClockConfigError";
  }
}

/** Return a fresh Date, reading MC_CLOCK at call time. */
export function now(): Date {
  const value = process.env.MC_CLOCK;
  if (value === undefined) return new Date();
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new ClockConfigError();
  }
  const date = new Date(value);
  const day = Number(value.slice(8, 10));
  const month = Number(value.slice(5, 7));
  const year = Number(value.slice(0, 4));
  if (day > new Date(Date.UTC(year, month, 0)).getUTCDate() || month < 1 || month > 12 || day < 1)
    throw new ClockConfigError();
  return date;
}
