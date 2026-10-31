import { aggregateFrdLinks, frdLinkGeometry } from "./frd-links";
import { dependencyDepths, dependencyStructure, horizontalCurve } from "./structure";
import type { DependencyFrd, DependencyOrder, FrdGeometry, FrdLink } from "./types";
/** Prototype frdDagView placement: two boxes per row, three chain-ranked items per box. */
export function frdLayout(
  input: readonly DependencyOrder[],
  index: readonly DependencyFrd[],
): FrdGeometry {
  const orders = dependencyStructure(input);
  const frds = index.filter((frd) => orders.some((order) => order.frd === frd.slug));
  if (!frds.length) return { width: 0, height: 0, boxes: [], items: [], links: [], edges: [] };
  const aggregated = aggregateFrdLinks(orders, frds);
  const graph = [...frds]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((frd) => ({
      id: frd.slug,
      frd: frd.slug,
      dependsOn: aggregated.filter((link) => link.to === frd.slug).map((link) => link.from),
    }));
  const depths = dependencyDepths(graph);
  const boxes = frds
    .map((frd) => {
      const own = orders.filter((order) => order.frd === frd.slug);
      const ids = new Set(own.map((order) => order.id));
      const ranks = dependencyDepths(
        own.map((order) => ({ ...order, dependsOn: order.dependsOn?.filter((id) => ids.has(id)) })),
      );
      const list = [...own].sort(
        (a, b) => (ranks.get(a.id) ?? 0) - (ranks.get(b.id) ?? 0) || a.id.localeCompare(b.id),
      );
      return {
        slug: frd.slug,
        x: 0,
        y: 0,
        width: 24 + Math.min(3, list.length) * 154 - 10,
        height: 46 + 24 + Math.ceil(list.length / 3) * 48 - 8,
        depth: depths.get(frd.slug) ?? 0,
        ids: list.map((order) => order.id),
      };
    })
    .sort(
      (a, b) =>
        a.depth - b.depth ||
        (index.find((f) => f.slug === a.slug)?.code ?? a.slug).localeCompare(
          index.find((f) => f.slug === b.slug)?.code ?? b.slug,
        ),
    );
  let height = 20;
  for (let i = 0; i < boxes.length; i += 2) {
    const row = boxes.slice(i, i + 2);
    row.forEach((box, k) => {
      box.x = 20 + k * 532;
      box.y = height;
    });
    height += Math.max(...row.map((box) => box.height)) + 56;
  }
  height += 20 - 56;
  const items = boxes.flatMap((box) =>
    box.ids.map((id, i) => ({
      id,
      x: box.x + 12 + (i % 3) * 154,
      y: box.y + 46 + 12 + Math.floor(i / 3) * 48,
      depth: box.depth,
      outOfScope: false,
    })),
  );
  const positions = new Map(items.map((item) => [item.id, item]));
  const byId = new Map(orders.map((order) => [order.id, order]));
  const edges = orders.flatMap((order) =>
    (order.dependsOn ?? []).flatMap((from) => {
      const a = positions.get(from),
        b = positions.get(order.id);
      return a && b && byId.get(from)?.frd === order.frd
        ? [{ from, to: order.id, path: horizontalCurve(a, b, 144, 40) }]
        : [];
    }),
  );
  const links = aggregated
    .map((link) => frdLinkGeometry(link, boxes))
    .filter((link): link is FrdLink => link !== null);
  return { width: 1048, height, boxes, items, links, edges };
}
