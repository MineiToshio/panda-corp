/**
 * event-time — chronological timestamp comparison (stream hygiene, 2026-07-07).
 *
 * Pins that mixed second/millisecond precisions order by real time, not by the
 * broken lexicographic compare (`"…00.500Z" < "…00Z"` because `.` < `Z`).
 */

import { describe, expect, it } from "vitest";

import { isNewerTimestamp } from "../event-time";

describe("isNewerTimestamp — mixed-precision ordering", () => {
  it("a millisecond stamp beats an earlier whole-second stamp in the same second", () => {
    // Lexicographically ".500Z" < "Z", which would (wrongly) say false.
    expect(isNewerTimestamp("2026-07-07T10:00:00.500Z", "2026-07-07T10:00:00Z")).toBe(true);
  });

  it("a whole-second stamp is NOT newer than a later millisecond stamp in the same second", () => {
    expect(isNewerTimestamp("2026-07-07T10:00:00Z", "2026-07-07T10:00:00.500Z")).toBe(false);
  });

  it("orders distinct whole seconds correctly", () => {
    expect(isNewerTimestamp("2026-07-07T10:00:02Z", "2026-07-07T10:00:01Z")).toBe(true);
    expect(isNewerTimestamp("2026-07-07T10:00:01Z", "2026-07-07T10:00:02Z")).toBe(false);
  });

  it("equal instants are not newer than each other (strict)", () => {
    expect(isNewerTimestamp("2026-07-07T10:00:00Z", "2026-07-07T10:00:00Z")).toBe(false);
    // Same instant expressed at different precisions → still not strictly newer.
    expect(isNewerTimestamp("2026-07-07T10:00:00.000Z", "2026-07-07T10:00:00Z")).toBe(false);
  });

  it("falls back to lexicographic compare when a value is unparseable", () => {
    expect(isNewerTimestamp("zzz", "aaa")).toBe(true);
    expect(isNewerTimestamp("aaa", "zzz")).toBe(false);
  });

  it("handles timezone offsets by normalising to the same instant", () => {
    // 10:00:00Z === 11:00:00+01:00 — neither is strictly newer.
    expect(isNewerTimestamp("2026-07-07T11:00:00+01:00", "2026-07-07T10:00:00Z")).toBe(false);
    expect(isNewerTimestamp("2026-07-07T12:00:00+01:00", "2026-07-07T10:00:00Z")).toBe(true);
  });
});
