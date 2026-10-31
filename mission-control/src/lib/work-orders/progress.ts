/** Pure progress resolver, safe for server and client views. */
export function aggregateProgress(orders: readonly { readonly state: string }[]): {
  done: number;
  total: number;
  pct: number;
} {
  const total = orders.length;
  const done = orders.filter((o) => o.state === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 1000) / 10;
  return { done, total, pct };
}
