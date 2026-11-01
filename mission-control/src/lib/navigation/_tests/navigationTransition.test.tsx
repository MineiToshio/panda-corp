import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, use, useState } from "react";
import { expect, it, vi } from "vitest";
import {
  NavigationProvider,
  useBackgroundRefresh,
  useNavigationRouter,
} from "../NavigationProvider";

import { useUrlState } from "../useUrlState";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

it("defers a live refresh until a suspended navigation commits and drops unmounted requests", async () => {
  let resolve!: (value: string) => void;
  const destination = new Promise<string>((done) => {
    resolve = done;
  });
  function PendingPage() {
    return <p>{use(destination)}</p>;
  }
  function Source() {
    const refresh = useBackgroundRefresh();
    return (
      <button type="button" onClick={refresh}>
        Refresh source
      </button>
    );
  }
  function Workspace() {
    const navigation = useNavigationRouter();
    const refresh = useBackgroundRefresh();
    const [moved, setMoved] = useState(false);
    router.push.mockImplementation(() => setMoved(true));
    return (
      <>
        <button type="button" onClick={() => navigation.push("/destination")}>
          Go
        </button>
        <button type="button" onClick={refresh}>
          Refresh workspace
        </button>
        {moved ? <PendingPage /> : <Source />}
      </>
    );
  }
  render(
    <NavigationProvider>
      <Suspense fallback="Loading">
        <Workspace />
      </Suspense>
    </NavigationProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByText("Go"));
  });
  fireEvent.click(screen.getByText("Refresh source"));
  expect(router.refresh).not.toHaveBeenCalled();
  await act(async () => resolve("Destination"));
  expect(await screen.findByText("Destination")).toBeVisible();
  expect(router.refresh).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Refresh workspace"));
  expect(router.refresh).toHaveBeenCalledTimes(1);
});

it.each([
  true,
  false,
])("coalesces queued requests and rechecks the committed predicate (%s)", async (stillNeeded) => {
  router.refresh.mockClear();
  let resolve!: (value: string) => void;
  const destination = new Promise<string>((done) => {
    resolve = done;
  });
  function PendingPage() {
    return <p>{use(destination)}</p>;
  }
  function Workspace() {
    const navigation = useNavigationRouter();
    const [moved, setMoved] = useState(false);
    const refresh = useBackgroundRefresh(() => stillNeeded || !moved);
    router.push.mockImplementation(() => setMoved(true));
    return (
      <>
        <button type="button" onClick={() => navigation.push("/destination")}>
          Go
        </button>
        <button type="button" onClick={refresh}>
          Live event
        </button>
        {moved ? <PendingPage /> : <p>Source</p>}
      </>
    );
  }
  render(
    <NavigationProvider>
      <Suspense fallback="Loading">
        <Workspace />
      </Suspense>
    </NavigationProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByText("Go"));
  });
  fireEvent.click(screen.getByText("Live event"));
  fireEvent.click(screen.getByText("Live event"));
  expect(router.refresh).not.toHaveBeenCalled();
  await act(async () => resolve("Destination"));
  expect(await screen.findByText("Destination")).toBeVisible();
  expect(router.refresh).toHaveBeenCalledTimes(stillNeeded ? 1 : 0);
});

it("defers a push during a background refresh until refresh settles and keeps its history entry", async () => {
  router.refresh.mockClear();
  router.push.mockClear();
  let finishRefresh!: () => void;
  let finishNavigation!: (value: string) => void;
  const refreshWork = new Promise<void>((resolve) => {
    finishRefresh = resolve;
  });
  const destination = new Promise<string>((resolve) => {
    finishNavigation = resolve;
  });

  function Refreshing() {
    use(refreshWork);
    return <p>Fresh data</p>;
  }
  function Destination() {
    return <p>{use(destination)}</p>;
  }
  function Workspace() {
    const navigation = useNavigationRouter();
    const refresh = useBackgroundRefresh();
    const [refreshing, setRefreshing] = useState(false);
    const [moved, setMoved] = useState(false);
    router.refresh.mockImplementation(() => setRefreshing(true));
    router.push.mockImplementation((href: string) => {
      window.history.pushState(null, "", href);
      setMoved(true);
    });
    return (
      <>
        <button type="button" onClick={refresh}>
          Background refresh
        </button>
        <button type="button" onClick={() => navigation.push("/destination")}>
          Go to destination
        </button>
        {refreshing && <Refreshing />}
        {moved && <Destination />}
      </>
    );
  }

  window.history.replaceState(null, "", "/source");
  render(
    <NavigationProvider>
      <Suspense fallback={<p>Loading transition</p>}>
        <Workspace />
      </Suspense>
    </NavigationProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByText("Background refresh"));
  });
  expect(router.refresh).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByText("Go to destination"));
  expect(router.push).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe("/source");

  await act(async () => finishRefresh());
  expect(screen.getByText("Go to destination")).toBeVisible();
  await act(async () => finishNavigation("Destination"));
  expect(await screen.findByText("Destination")).toBeVisible();
  expect(window.location.pathname).toBe("/destination");
  expect(router.push).toHaveBeenCalledTimes(1);
});

it("notifies URL subscribers after a router push commits without a native history event", async () => {
  function Selection() {
    const [wo] = useUrlState("wo", "");
    return <output aria-label="Selected work order">{wo || "none"}</output>;
  }
  function Open() {
    const navigation = useNavigationRouter();
    return (
      <button
        type="button"
        onClick={() => navigation.push("/portfolio/demo/observability?wo=WO-01-003")}
      >
        Open detail
      </button>
    );
  }
  router.push.mockImplementation((href: string) => window.history.pushState(null, "", href));
  render(
    <NavigationProvider>
      <Selection />
      <Open />
    </NavigationProvider>,
  );
  expect(screen.getByLabelText("Selected work order")).toHaveTextContent("none");
  await act(async () => {
    fireEvent.click(screen.getByText("Open detail"));
  });
  expect(screen.getByLabelText("Selected work order")).toHaveTextContent("WO-01-003");
});
