import "@testing-library/jest-dom/vitest";
import { act } from "@testing-library/react";
import { vi } from "vitest";
import "vitest";

/**
 * Web Storage polyfill for the jsdom test environment.
 *
 * Node 20.9+ (unflagged from Node ~24) exposes a built-in global `localStorage`
 * that is a non-functional husk unless the process is launched with a valid
 * `--localstorage-file`: its methods are `undefined` and calling them throws.
 * Vitest's jsdom environment only overlays window keys it does NOT already see
 * on the global, and its allow-list whitelists `Storage` but not `localStorage`
 * — so the broken Node built-in shadows jsdom's working `localStorage`, and
 * every test that uses the ambient store (build-mode, digest, theme) fails with
 * "localStorage.clear is not a function". Install a spec-faithful in-memory
 * Storage ONLY when the ambient one is non-functional, so older Node / a real
 * jsdom Storage is left untouched. A `configurable` descriptor keeps per-file
 * `Object.defineProperty(window, "localStorage", …)` overrides working.
 */
class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();
  [name: string]: unknown;

  get length(): number {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }
}

function ensureFunctionalStorage(name: "localStorage" | "sessionStorage"): void {
  const current = (globalThis as Record<string, unknown>)[name] as Storage | undefined;
  const isFunctional =
    typeof current?.clear === "function" && typeof current?.getItem === "function";
  if (isFunctional) return;
  Object.defineProperty(globalThis, name, {
    value: new MemoryStorage(),
    writable: true,
    configurable: true,
  });
}

ensureFunctionalStorage("localStorage");
ensureFunctionalStorage("sessionStorage");

/**
 * Mock next/font/google (DR-054 font wiring): in jsdom the real loader is a
 * build-time network fetch and isn't a callable at test time. Any font import
 * (Pixelify_Sans, Space_Grotesk, …) returns a stub with the CSS-variable shape
 * the layout consumes.
 */
vi.mock("next/font/google", () => {
  const font = () => ({ variable: "", className: "", style: { fontFamily: "" } });
  return { Pixelify_Sans: font, Space_Grotesk: font };
});

/**
 * Mock next/navigation CLIENT HOOKS (useRouter / useSearchParams / usePathname): jsdom has no App
 * Router context, so any client component that reads them (TabBar, AppShell, Nav…) throws
 * "invariant expected app router to be mounted" when rendered outside the Next runtime. We stub the
 * hooks with inert defaults and keep everything else REAL (notFound/redirect still throw), so
 * server-component page tests that now embed those client children render without a provider.
 * A test that needs specific navigation behaviour installs its own per-file `vi.mock` (overrides this).
 */
vi.mock("next/navigation", async (importActual) => {
  const actual = await importActual<typeof import("next/navigation")>();
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => "/",
  };
});

/**
 * vi.runAllMicrotasksAsync — polyfill for vitest 4.x.
 *
 * vitest 4.1.9 exposes `vi.runAllTimersAsync` / `vi.runOnlyPendingTimersAsync`
 * but not `vi.runAllMicrotasksAsync`. The test-writer authored tests against
 * the microtask-flush helper; we fill the gap here so the test file compiles
 * and runs without modification.
 *
 * Implementation: wraps multiple microtask flushes inside React's `act` so
 * that pending state updates (setState calls inside async handlers) are flushed
 * to the DOM before the test assertion runs. Without `act`, React batches the
 * update and the DOM still shows the pre-click state when asserted.
 */
if (!("runAllMicrotasksAsync" in vi)) {
  (vi as unknown as Record<string, unknown>).runAllMicrotasksAsync = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  };
}

/**
 * EventSource global stub (WO-06-007 PartyLiveShell)
 *
 * jsdom does not implement EventSource. PartyLiveShell (client boundary) calls
 * useLiveSnapshot which opens an EventSource on mount. Tests that render the
 * active PartyTab path (which includes PartyLiveShell) need this stub to
 * avoid "EventSource is not defined" errors.
 *
 * The stub never fires any events — it behaves as a no-op SSE connection that
 * stays in CONNECTING state, so PartyLiveShell falls back to its initialSnapshot
 * prop (the server-derived snapshot) for the entire test duration. This is the
 * correct behaviour for server-rendered integration tests that don't exercise
 * the live SSE path.
 *
 * Tests that exercise the live SSE path (useLiveSnapshot.test.ts) install their
 * own per-test mock which overrides this global stub.
 */
if (typeof globalThis.EventSource === "undefined") {
  class StubEventSource {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSED = 2;

    readonly url: string;
    readyState: number = StubEventSource.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string) {
      this.url = url;
    }

    /** No-op — the stub never connects. Tests that need events inject their own. */
    close(): void {
      this.readyState = StubEventSource.CLOSED;
    }

    addEventListener(): void {}
    removeEventListener(): void {}
    dispatchEvent(): boolean {
      return false;
    }
  }

  (globalThis as { EventSource?: unknown }).EventSource = StubEventSource;
}

declare module "vitest" {
  interface VitestUtils {
    /**
     * Flush the JavaScript microtask queue inside a React `act` boundary.
     * Polyfilled in vitest.setup.ts — not natively available in vitest 4.x.
     */
    runAllMicrotasksAsync(): Promise<void>;
  }
}
