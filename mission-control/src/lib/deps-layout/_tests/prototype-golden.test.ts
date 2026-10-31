import { describe, expect, it } from "vitest";
import { frdLayout } from "../frd-layout";
import { workOrderLayout } from "../work-order-layout";
import fixtures from "./fixtures/prototype-layouts.json";

describe("prototype arithmetic golden coordinates", () => {
  for (const fixture of fixtures)
    it(`AC-12-004.1 AC-12-004.8: ${fixture.id} matches frozen prototype placement`, () => {
      const frd = frdLayout(fixture.orders, fixture.frds);
      expect({
        width: frd.width,
        height: frd.height,
        boxes: frd.boxes,
        items: frd.items.map(({ id, x, y }) => ({ id, x, y })),
      }).toEqual(fixture.frd);
      const work = workOrderLayout(fixture.orders),
        scoped = workOrderLayout(fixture.orders, fixture.frds[1]?.slug);
      expect({
        width: work.width,
        height: work.height,
        nodes: work.nodes,
        steps: work.steps,
      }).toEqual(fixture.work);
      expect({
        width: scoped.width,
        height: scoped.height,
        nodes: scoped.nodes,
        steps: scoped.steps,
      }).toEqual(fixture.scoped);
      expect(
        JSON.stringify(
          frdLayout(
            fixture.orders.map((order) => ({ ...order, state: "blocked" })),
            fixture.frds,
          ),
        ),
      ).toBe(JSON.stringify(frd));
    });
});
