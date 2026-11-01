import { expect, it } from "vitest";
import { noiseBudget, summarize } from "../calibration.mjs";

it("does not convert missing measurements into zero drift", () => {
  expect(summarize([])).toEqual({ count: 0, p50: null, p95: null, p99: null, max: null });
  expect(() => summarize([NaN])).toThrow();
});
it("bases a proposed tolerance on repeated same-side noise, not product drift", () => {
  expect(noiseBudget([0, 0, 0])).toBe(0.005);
  expect(noiseBudget([0.01, 0.02, 0.03])).toBeCloseTo(0.035);
  expect(noiseBudget([])).toBeNull();
});
it("reports an observed distribution using nearest ranks", () => {
  expect(summarize([0.4, 0.1, 0.2, 0.3])).toEqual({
    count: 4,
    p50: 0.2,
    p95: 0.4,
    p99: 0.4,
    max: 0.4,
  });
});
it("keeps rare renderer flakes visible rather than hiding them in a pooled percentile", () => {
  expect(noiseBudget([...Array(200).fill(0), 0.02])).toBeCloseTo(0.025);
});
