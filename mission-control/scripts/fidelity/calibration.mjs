/** Missing samples remain unknown; a high product mismatch cannot calibrate renderer noise. */
export function summarize(values) {
  if (values.some((n) => !Number.isFinite(n) || n < 0 || n > 1)) {
    throw new Error("Pixel ratios must be finite numbers between zero and one");
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p) => sorted[Math.ceil(p * sorted.length) - 1] ?? null;
  return {
    count: sorted.length,
    p50: rank(0.5),
    p95: rank(0.95),
    p99: rank(0.99),
    max: sorted.at(-1) ?? null,
  };
}

export function noiseBudget(repeatedSameSideRatios) {
  const stats = summarize(repeatedSameSideRatios);
  return stats.max === null ? null : Math.min(1, stats.max + 0.005);
}
