import type { Page, Request, Response } from "@playwright/test";
import { expect, it, vi } from "vitest";
import {
  emitUntilRefresh,
  refreshFromLiveFrame,
} from "../../../../e2e/persistent-navigation/_live-race";

function harness() {
  let observe: ((request: Request) => void) | undefined;
  let accepts: ((response: Response) => boolean) | undefined;
  let resolve: (response: Response) => void = () => {};
  const mainFrame = {};
  const on = vi.fn((_event: string, listener: (request: Request) => void) => {
    observe = listener;
  });
  const off = vi.fn();
  const page = {
    url: () => "http://localhost/portfolio/mission-control/observability?view=deps&focus=WO-01-003",
    mainFrame: () => mainFrame,
    on,
    off,
    waitForResponse: (predicate: (response: Response) => boolean) => {
      accepts = predicate;
      return new Promise<Response>((r) => {
        resolve = r;
      });
    },
    evaluate: async () => true,
    clock: { runFor: async () => {} },
  } as unknown as Page;
  function response(
    options: {
      url?: string;
      headers?: Record<string, string>;
      method?: string;
      frame?: unknown;
    } = {},
  ) {
    const url = options.url ?? page.url();
    const request = {
      url: () => url,
      headers: () => options.headers ?? { rsc: "1" },
      method: () => options.method ?? "GET",
      frame: () => options.frame ?? mainFrame,
    } as unknown as Request;
    const response = { url: () => url, request: () => request } as unknown as Response;
    return { request, response };
  }
  return {
    page,
    off,
    response,
    request: (r: Request) => observe?.(r),
    accepts: (r: Response) => accepts?.(r),
    resolve: (r: Response) => resolve(r),
  };
}

it("ignores delayed old responses and prefetches without filtering away a real wrong-focus refresh", async () => {
  const h = harness();
  const old = h.response({
    url: "http://localhost/portfolio/mission-control/observability?view=deps",
  });
  const run = refreshFromLiveFrame(h.page, 2);
  // The old request began before arming; its response may arrive after selection changed.
  expect(h.accepts(old.response)).toBe(false);
  const rejected: Parameters<typeof h.response>[0][] = [
    { headers: { rsc: "1", "next-router-prefetch": "1" } },
    { headers: { rsc: "1", "next-router-segment-prefetch": "/_tree" } },
    { headers: { rsc: "1", purpose: "prefetch" } },
    { url: "http://localhost/other?focus=WO-01-003" },
    { url: "http://foreign.example/portfolio/mission-control/observability?focus=WO-01-003" },
    { frame: {} },
    { method: "POST" },
  ];
  for (const options of rejected) {
    const candidate = h.response(options);
    h.request(candidate.request);
    expect(h.accepts(candidate.response)).toBe(false);
  }
  const actual = h.response({
    url: "http://localhost/portfolio/mission-control/observability?view=deps",
  });
  h.request(actual.request);
  // Deliberately do NOT filter on focus: the spec's original assertion must catch this regression.
  expect(h.accepts(actual.response)).toBe(true);
  h.resolve(actual.response);
  expect(await run).toBe(actual.response);
  expect(h.off).toHaveBeenCalledOnce();
});

it("propagates a refresh timeout and cleans up its own page request listener", async () => {
  const h = harness();
  vi.spyOn(h.page, "waitForResponse").mockRejectedValue(new Error("RSC timeout sentinel"));
  await expect(refreshFromLiveFrame(h.page, 2)).rejects.toThrow("RSC timeout sentinel");
  expect(h.off).toHaveBeenCalledOnce();
});

it("handles an already rejected response wait without an orphan rejection", async () => {
  const h = harness();
  await expect(
    emitUntilRefresh(h.page, 2, Promise.reject(new Error("response failed"))),
  ).rejects.toThrow("response failed");
});
