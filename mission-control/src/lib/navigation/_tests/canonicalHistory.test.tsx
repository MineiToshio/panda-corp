import { act, render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { NavigationCanonical } from "../NavigationCanonical";
import { updateNavigation } from "../useUrlState";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => window.location.pathname,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

beforeEach(() => {
  replace.mockClear();
  window.history.replaceState(null, "", "/portfolio/mission-control/observability?wo=WO-25-001");
});

it("AC-25-003.1: noncanonical URLs are resolved by the server, never renamed behind Next", async () => {
  window.history.replaceState(null, "", "/portfolio?portfolioView=accounts#providers");
  await act(async () => {
    render(<NavigationCanonical href="/portfolio?view=cuentas" />);
  });
  expect(window.location.search).toBe("?portfolioView=accounts");
  expect(window.location.hash).toBe("#providers");
});

it("AC-25-002.1: a late server tree cannot replace a newer client selection", async () => {
  act(() => updateNavigation({ woview: "full" }));
  await act(async () => {
    render(
      <NavigationCanonical href="/portfolio/mission-control/observability?wo=WO-25-001&woview=summary" />,
    );
  });
  expect(new URL(window.location.href).searchParams.get("woview")).toBe("full");
  expect(replace).not.toHaveBeenCalled();
});

it("AC-25-002.1: a restored client entry remains authoritative when its server tree remounts", async () => {
  updateNavigation({ woview: "full" });
  const fullState: unknown = window.history.state;
  updateNavigation({ woview: "summary" });
  window.history.replaceState(
    fullState,
    "",
    "/portfolio/mission-control/observability?wo=WO-25-001&woview=full",
  );
  window.dispatchEvent(new PopStateEvent("popstate", { state: fullState }));
  await act(async () => {
    render(
      <NavigationCanonical href="/portfolio/mission-control/observability?wo=WO-25-001&woview=summary" />,
    );
  });
  expect(new URL(window.location.href).searchParams.get("woview")).toBe("full");
  expect(replace).not.toHaveBeenCalled();
});

it("AC-25-002.1: a client selection cancels canonical work queued earlier in the same commit", async () => {
  await act(async () => {
    render(
      <NavigationCanonical href="/portfolio/mission-control/observability?wo=WO-25-001&woview=summary" />,
    );
    updateNavigation({ woview: "full" });
  });
  expect(new URL(window.location.href).searchParams.get("woview")).toBe("full");
  expect(replace).not.toHaveBeenCalled();
});

it("AC-25-003.1: an unmounted canonical effect cannot replace the active entry", async () => {
  await act(async () => {
    const view = render(<NavigationCanonical href="/portfolio/mission-control/summary" />);
    view.unmount();
  });
  expect(window.location.pathname).toBe("/portfolio/mission-control/observability");
});

it("AC-25-002.1: a confirmed server entry rejects an older canonical tree on remount", async () => {
  window.history.replaceState({ source: "router" }, "", "/portfolio/mission-control/changes");
  const current = render(<NavigationCanonical href="/portfolio/mission-control/changes" />);
  await act(async () => {
    await Promise.resolve();
  });
  current.unmount();
  await act(async () => {
    render(<NavigationCanonical href="/portfolio/mission-control/observability" />);
  });
  expect(window.location.pathname).toBe("/portfolio/mission-control/changes");
  expect(window.history.state.source).toBe("router");
});

it("AC-25-002.1: an anchor change does not let an older tree rewrite client selection", async () => {
  updateNavigation({ woview: "full" });
  window.history.replaceState(window.history.state, "", `${window.location.href}#goal`);
  await act(async () => {
    render(
      <NavigationCanonical href="/portfolio/mission-control/observability?wo=WO-25-001&woview=summary" />,
    );
  });
  expect(new URL(window.location.href).searchParams.get("woview")).toBe("full");
  expect(window.location.hash).toBe("#goal");
});

it("AC-25-002.1/003.1: marking an exact canonical URL preserves Next metadata without a URL write", async () => {
  const routerState = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: ["portfolio"] } };
  window.history.replaceState(routerState, "", "/portfolio?view=cuentas");
  const replaceState = vi.spyOn(window.history, "replaceState");
  await act(async () => {
    render(<NavigationCanonical href="/portfolio?view=cuentas" />);
  });
  expect(window.history.state).toMatchObject(routerState);
  expect(replaceState).toHaveBeenLastCalledWith(expect.objectContaining(routerState), "");
  replaceState.mockRestore();
});
