export interface Distribution {
  count: number;
  p50: number | null;
  p95: number | null;
  p99: number | null;
  max: number | null;
}
export function summarize(values: readonly number[]): Distribution;
export function noiseBudget(repeatedSameSideRatios: readonly number[]): number | null;
