import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { validateNavigationQuery } from "@/lib/navigation/keys";
import { parseNavigationUrl } from "@/lib/navigation/urls";
import type { WorkOrder } from "@/lib/work-orders/work-orders";
import { filterOrders, parseStates } from "../selection";
import { WoViews } from "../WoViews";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }) }));
const orders: WorkOrder[] = [
  { id: "WO-01-001", title: "First", frd: "frd-01-core", state: "done", relPath: "" },
  { id: "WO-01-002", title: "Second", frd: "frd-01-core", state: "review", relPath: "" },
  {
    id: "WO-02-001",
    title: "Third",
    frd: "frd-02-next",
    state: "fail",
    relPath: "",
    blockedReason: "Needs fix",
  },
];
const frds = [
  { slug: "frd-01-core", code: "FRD-01", title: "Core" },
  { slug: "frd-02-next", code: "FRD-02", title: "Next" },
];
describe("AC-05-008.1 AC-05-008.2 AC-12-002.3 Observabilidad views", () => {
  it("starts collapsed, expands all, and uses URL-owned state and FRD filters", async () => {
    render(
      <WoViews
        orders={orders}
        frds={frds}
        drifts={{}}
        href="/portfolio/demo/observability"
        state={{}}
      />,
    );
    expect(screen.getByRole("button", { name: "Por FRD" })).toHaveAttribute("aria-pressed", "true");
    expect(document.querySelector("details")).not.toHaveAttribute("open");
    await userEvent.click(screen.getByRole("button", { name: "Expandir todo" }));
    expect([...document.querySelectorAll("details")].every((row) => row.open)).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: /^En revisión 1/ }));
    expect(push.mock.lastCall?.[0]).toContain("state=review");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Filtrar por FRD" }),
      "FRD-01",
    );
    expect(push.mock.lastCall?.[0]).toContain("frd=FRD-01");
    expect(screen.queryByText(/Línea de tiempo|RPG/)).not.toBeInTheDocument();
  });
  it("unions states and intersects FRD, opens filtered rows and shows no-match state", () => {
    expect(filterOrders(orders, "frd-01-core", parseStates("review,done"))).toHaveLength(2);
    expect(parseStates("invalid")).toEqual([]);
    render(
      <WoViews
        orders={orders}
        frds={frds}
        drifts={{}}
        href="/portfolio/demo/observability?state=todo"
        state={{ state: "todo" }}
      />,
    );
    expect(screen.getByText("Ninguna work order coincide con el filtro.")).toBeInTheDocument();
  });
  it("AC-12-006.1 accepts dependency-map slug deep links through the real validator and rejects unsafe values", () => {
    const state = parseNavigationUrl(
      "/portfolio/demo/observability?view=deps&dag=wo&frd=frd-01-core&focus=WO-01-001",
    );
    expect(validateNavigationQuery("observability", state)).toEqual({ ok: true });
    for (const frd of ["../../secret", "frd-01-../oops", "frd-01-/bad", "frd-01-"])
      expect(validateNavigationQuery("observability", { frd }).ok).toBe(false);
  });
});

it("AC-05-008.2 can clear a bookmarked fail filter after all failures disappear", async () => {
  render(
    <WoViews
      orders={orders.filter((order) => order.state !== "fail")}
      frds={frds}
      drifts={{}}
      href="/portfolio/demo/observability?state=fail"
      state={{ state: "fail" }}
    />,
  );
  expect(screen.getByText("Ninguna work order coincide con el filtro.")).toBeInTheDocument();
  const tile = screen.getByRole("button", { name: /^Bloqueado 0/ });
  expect(tile).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(tile);
  expect(push.mock.lastCall?.[0]).not.toContain("state=");
});
