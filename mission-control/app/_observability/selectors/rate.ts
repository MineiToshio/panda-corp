/**
 * WO-12-003 — `eventsPerMinute` selector (IF-12-rate).
 *
 * Pure selector: bucket the event tail into per-minute counts over a sliding
 * window, with an optional per-agent breakdown.
 *
 * Consumed by:
 *   - FRD-06 ActivityPulse (WO-06-009) — stalled-pulse signal
 *   - FRD-18 dashboard — rate chart
 *
 * Single source of the rate metric — no duplication (AC-12-007.1, REQ-12-007).
 *
 * Regression anchors from progress.md incidents:
 *   B1' (WO-13-001, 2026-06-16): typeof NaN === "number" — window=NaN must
 *     not silently produce wrong output; use Number.isFinite / Number.isNaN.
 *   I2  (WO-13-001, 2026-06-16): empty events → zeroed buckets, not throw.
 *   I3  (WO-13-001, 2026-06-16): agent field must be a plain string before
 *     it is used as a byAgent key; non-string agent values are silently ignored.
 *   FREEZE-ON-RED (WO-02-004, 2026-06-16): events with missing/invalid `at`
 *     must be silently skipped; per-item errors must not abort the batch.
 *
 * Traceability: AC-12-007.1 → REQ-12-007 → IF-12-rate → WO-12-003.
 */

import type { Event } from "../../../lib/events";

/**
 * A per-minute bucket of event counts.
 *
 * `minute`  — ISO minute key "YYYY-MM-DDTHH:MM" (UTC, no seconds).
 * `total`   — total count of all events in this minute.
 * `byAgent` — per-agent count; only string-valued `agent` fields are tracked.
 *             An event with no `agent` (or a non-string `agent`) increments
 *             `total` but is NOT reflected in `byAgent`.
 */
export type Bucket = {
  minute: string;
  total: number;
  byAgent: Record<string, number>;
};

/**
 * Derive per-minute event counts from the capped event tail.
 *
 * @param events - The already-parsed, capped `Event[]` from `lib/events`.
 *                 No re-reading, no I/O (blueprint §3, REQ-12-007).
 * @param window - Number of minutes to cover (e.g. 30). Must be a positive
 *                 integer. Invalid values (NaN, Infinity, negative) yield []
 *                 or a safe empty result without throwing (B1' anchor).
 * @param now    - Reference instant. Injected for determinism in tests.
 *                 Defaults to `new Date()` at call-time.
 * @returns      `Bucket[]` with exactly `window` entries (oldest first),
 *               or `[]` when `window` is 0 or invalid.
 *               Never throws.
 */
export function eventsPerMinute(events: Event[], window: number, now?: Date): Bucket[] {
  // --- Guard: invalid window values (B1' regression anchor) ---
  // NaN: typeof NaN === "number" so we MUST test with Number.isNaN, not typeof.
  if (!Number.isFinite(window) || Number.isNaN(window)) {
    // NaN or ±Infinity → safe empty result, no throw.
    return [];
  }

  // Clamp negative windows to 0.
  const safeWindow = Math.max(0, Math.trunc(window));
  if (safeWindow === 0) {
    return [];
  }

  // --- Reference instant ---
  const reference = now instanceof Date && Number.isFinite(now.getTime()) ? now : new Date();

  // --- Build the bucket index ---
  // Floor `reference` to its minute boundary, then step back one minute to get
  // the last *completed* full minute before `reference`.
  //
  // Example: NOW = 12:30:45 → floor = 12:30:00 → newestMinuteMs = 12:29:00.
  //   window=5 → keys: [12:25, 12:26, 12:27, 12:28, 12:29] (oldest first).
  //
  // Bucket coverage: a bucket keyed "YYYY-MM-DDTHH:MM" covers the half-open
  // interval [MM:00, MM+1:00). Events at exact minute boundaries (e.g. 12:28:00)
  // belong to bucket "12:28".
  const referenceMs = reference.getTime();
  const newestMinuteMs = Math.floor(referenceMs / 60_000) * 60_000 - 60_000;

  // Initialize buckets (oldest first).
  // bucketIndex maps minute key → bucket; we fill it in order.
  const minuteKeys: string[] = [];
  for (let i = safeWindow - 1; i >= 0; i--) {
    const bucketMs = newestMinuteMs - i * 60_000;
    minuteKeys.push(toMinuteKey(bucketMs));
  }

  // Pre-allocate the bucket map for O(1) lookup during event classification.
  // byAgent uses Object.create(null) — a null-prototype object — so that agent keys
  // like "__proto__", "constructor", "toString", "valueOf", "hasOwnProperty" are stored
  // as own enumerable properties instead of colliding with inherited Object.prototype
  // members. Without this, `byAgent["constructor"] ?? 0` reads the inherited Function,
  // causing `Function + 1 = "function Object() { [native code] }1"` (string corruption).
  const bucketMap = new Map<string, Bucket>();
  for (const key of minuteKeys) {
    bucketMap.set(key, {
      minute: key,
      total: 0,
      byAgent: Object.create(null) as Record<string, number>,
    });
  }

  // --- Classify events into buckets ---
  for (const ev of events) {
    // B1' + FREEZE-ON-RED: guard invalid `at` values before arithmetic.
    const parsed = Date.parse(ev.at);
    if (!Number.isFinite(parsed)) {
      // Invalid / missing timestamp → skip this event silently.
      continue;
    }

    // Floor the event's timestamp to its minute key.
    const evMinuteMs = Math.floor(parsed / 60_000) * 60_000;
    const evKey = toMinuteKey(evMinuteMs);

    const bucket = bucketMap.get(evKey);
    if (bucket === undefined) {
      // Event is outside the window (older or future) → skip.
      continue;
    }

    bucket.total += 1;

    // I3 regression: only track string-valued agent fields.
    // Arrays, numbers, booleans, etc. must not appear as byAgent keys.
    if (typeof ev.agent === "string" && ev.agent.length > 0) {
      // Use Object.hasOwn to read the existing count so that agent keys that
      // collide with Object.prototype members ("constructor", "toString",
      // "valueOf", "hasOwnProperty") are read as own properties only, not the
      // inherited function. Without this, `bucket.byAgent["constructor"] ?? 0`
      // evaluates to the built-in constructor Function (truthy), so `Function + 1`
      // produces the string "function Object() { [native code] }1" — a B1b violation.
      const current = Object.hasOwn(bucket.byAgent, ev.agent)
        ? (bucket.byAgent[ev.agent] as number)
        : 0;
      bucket.byAgent[ev.agent] = current + 1;
    }
  }

  // --- Return buckets in chronological (ascending) order ---
  // Deep-copy each bucket so mutations by one consumer cannot corrupt another
  // (FRD-06 / FRD-18 consumer isolation invariant).
  return minuteKeys.map((key) => {
    // Non-null assertion is safe: every key was inserted into the map above.
    // biome-ignore lint/style/noNonNullAssertion: key is always present — it was just inserted
    const src = bucketMap.get(key)!;
    // Use Object.assign into a null-prototype object so that dangerous agent keys
    // ("__proto__", "constructor", etc.) survive the copy as own enumerable
    // properties and do not corrupt Object.prototype. Spread `{ ...src.byAgent }`
    // copies into a plain `{}`, which would reintroduce the prototype collision.
    return {
      minute: src.minute,
      total: src.total,
      byAgent: Object.assign(Object.create(null) as Record<string, number>, src.byAgent),
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a UTC timestamp (milliseconds, floored to minute boundary) to the
 * ISO minute key format "YYYY-MM-DDTHH:MM" used as a bucket identifier.
 *
 * We use explicit UTC component extraction so the key is always UTC regardless
 * of the runtime's local timezone (WO-12-001 ordering regression anchor).
 */
function toMinuteKey(msAtMinuteBoundary: number): string {
  const d = new Date(msAtMinuteBoundary);
  const yyyy = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mo}-${dd}T${hh}:${mi}`;
}
