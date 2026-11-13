import { expect, type Page, type Request, type Response } from "@playwright/test";

const LIVE_DEBOUNCE_MS = 200;
const RECONNECT_STEP_MS = 1_000;
const RE_EMIT_MS = 1_000;

type ControlledStream = {
  readyState: number;
  onmessage: ((event: MessageEvent<string>) => void) | null;
};

/**
 * Own the transport with a stream that stays open: a fulfilled route ends at once, so a real
 * EventSource would always be closed or reconnecting here. Next's history, RSC and router stay real.
 */
export async function controlLiveFrames(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const streams: ControlledStream[] = [];
    Reflect.set(window, "navigationLiveStreams", streams);
    class ControlledEventSource extends EventTarget {
      readyState = 1;
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: MessageEvent<string>) => void) | null = null;
      constructor(readonly url: string) {
        super();
        streams.push(this);
        queueMicrotask(() => this.onopen?.());
      }
      close(): void {
        this.readyState = 2;
        streams.splice(streams.indexOf(this), 1);
      }
    }
    Object.assign(window, { EventSource: ControlledEventSource });
  });
  await page.clock.install();
}

/** Never emit into a gap: advance the hook's reconnect timer until an open stream exists. */
async function waitForOpenStream(page: Page): Promise<void> {
  await expect(async () => {
    const open = await page.evaluate(() =>
      (Reflect.get(window, "navigationLiveStreams") as ControlledStream[]).some(
        (stream) => stream.readyState === 1,
      ),
    );
    if (!open) await page.clock.runFor(RECONNECT_STEP_MS);
    expect(open).toBe(true);
  }).toPass();
}

export async function emitLiveFrame(page: Page, version: number): Promise<void> {
  await waitForOpenStream(page);
  await page.evaluate((version) => {
    const streams = Reflect.get(window, "navigationLiveStreams") as ControlledStream[];
    const frame = {
      events: [],
      byProject: {},
      stateVersion: version,
      lastEventAt: new Date(Date.UTC(2026, 9, 31, 12, 0, version)).toISOString(),
    };
    for (const stream of streams)
      stream.onmessage?.(new MessageEvent("message", { data: JSON.stringify(frame) }));
  }, version);
  // Drive the transport's documented 150 ms debounce, not a navigation completion heuristic.
  await page.clock.runFor(LIVE_DEBOUNCE_MS);
}

/**
 * Keep advancing until the refresh arrives: a subscriber that remounted or reconnected takes the
 * next frame as its baseline, so only a later frame can prove a refresh. It still must produce one.
 */
export async function emitUntilRefresh(
  page: Page,
  version: number,
  refreshed: Promise<Response>,
): Promise<Response> {
  let outcome: { response: Response } | { error: unknown } | undefined;
  // Handle both branches immediately: a success-only .then creates an orphan rejection on timeout.
  const completed = refreshed.then(
    (response) => {
      outcome = { response };
    },
    (error: unknown) => {
      outcome = { error };
    },
  );
  for (let next = version; !outcome; next += 1) {
    await emitLiveFrame(page, next);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        completed,
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, RE_EMIT_MS);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  if ("error" in outcome) throw outcome.error;
  return outcome.response;
}

/** Observe only a NEW, non-prefetch RSC GET issued by this page's main frame for its current route. */
export async function refreshFromLiveFrame(page: Page, version: number): Promise<Response> {
  const location = new URL(page.url());
  const requests = new Set<Request>();
  function observe(request: Request): void {
    const headers = request.headers();
    const target = new URL(request.url());
    if (
      request.method() === "GET" &&
      headers.rsc === "1" &&
      !("next-router-prefetch" in headers) &&
      !("next-router-segment-prefetch" in headers) &&
      !/prefetch/i.test(`${headers.purpose ?? ""} ${headers["sec-purpose"] ?? ""}`) &&
      target.origin === location.origin &&
      target.pathname === location.pathname &&
      request.frame() === page.mainFrame()
    )
      requests.add(request);
  }
  page.on("request", observe);
  // Request identity excludes a response whose request began before this listener was armed.
  // Do not select on focus/query: a genuine wrong-focus refresh must still reach the spec assertion.
  const refreshed = page.waitForResponse((response) => requests.has(response.request()), {
    timeout: 12_000,
  });
  try {
    return await emitUntilRefresh(page, version, refreshed);
  } finally {
    page.off("request", observe);
  }
}
