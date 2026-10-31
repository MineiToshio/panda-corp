import type { DependencyFrd, DependencyOrder, FrdBox, FrdLink } from "./types";
/** Aggregate declared cross-FRD links; majority wins, code breaks ties. */
export function aggregateFrdLinks(
  orders: readonly DependencyOrder[],
  frds: readonly DependencyFrd[],
): { from: string; to: string; count: number; backCount: number }[] {
  const byId = new Map(orders.map((order) => [order.id, order]));
  const pairs = new Map<string, Map<string, number>>();
  for (const order of orders)
    for (const id of order.dependsOn ?? []) {
      const from = byId.get(id)?.frd;
      if (!from || from === order.frd) continue;
      const destinations = pairs.get(from) ?? new Map<string, number>();
      destinations.set(order.frd, (destinations.get(order.frd) ?? 0) + 1);
      pairs.set(from, destinations);
    }
  const code = (slug: string) => frds.find((frd) => frd.slug === slug)?.code ?? slug;
  return [...pairs].flatMap(([from, destinations]) =>
    [...destinations].flatMap(([to, count]) => {
      const backCount = pairs.get(to)?.get(from) ?? 0;
      return count > backCount || (count === backCount && code(from) < code(to))
        ? [{ from, to, count, backCount }]
        : [];
    }),
  );
}
/** Prototype box-to-box cubic geometry and midpoint count labels. */
export function frdLinkGeometry(
  link: { from: string; to: string; count: number; backCount: number },
  boxes: readonly FrdBox[],
): FrdLink | null {
  const a = boxes.find((box) => box.slug === link.from),
    b = boxes.find((box) => box.slug === link.to);
  if (!a || !b) return null;
  let x1: number, y1: number, x2: number, y2: number, path: string;
  if (a.y === b.y) {
    const right = b.x > a.x;
    x1 = right ? a.x + a.width : a.x;
    x2 = right ? b.x : b.x + b.width;
    y1 = a.y + 22;
    y2 = b.y + 22;
    const mx = (x1 + x2) / 2;
    path = `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  } else {
    const down = b.y > a.y;
    x1 = a.x + a.width / 2;
    y1 = down ? a.y + a.height : a.y;
    x2 = b.x + b.width / 2;
    y2 = down ? b.y : b.y + b.height;
    const my = (y1 + y2) / 2;
    path = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
  }
  return { ...link, path, labelX: (x1 + x2) / 2, labelY: (y1 + y2) / 2 - 6 };
}
