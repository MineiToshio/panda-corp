import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, use, useState } from "react";
import { expect, it, vi } from "vitest";
import {
  NavigationProvider,
  useBackgroundRefresh,
  useNavigationRouter,
} from "../NavigationProvider";

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
