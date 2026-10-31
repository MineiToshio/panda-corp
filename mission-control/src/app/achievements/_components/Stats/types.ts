/** Additional source-backed record values shared with the statistics seam. */
export interface StatsRecords {
  readonly peakWeek: number | null;
  readonly capturedLessons: number | null;
  readonly subagents: number;
}
