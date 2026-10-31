import type { Page } from "@playwright/test";

/** Inject frames through the real EventSource message boundary, without filesystem writes. */
export async function controlLiveFrames(page: Page): Promise<void> {
  await page.route("**/api/live*", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: ": controlled connection\n\n",
    }),
  );
  await page.addInitScript(() => {
    const streams: EventSource[] = [];
    Reflect.set(window, "navigationLiveStreams", streams);
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      constructor(url: string | URL, options?: EventSourceInit) {
        super(url, options);
        streams.push(this);
      }
    };
  });
  await page.clock.install();
}

export async function emitLiveFrame(page: Page, version: number): Promise<void> {
  await page.evaluate((version) => {
    const streams = Reflect.get(window, "navigationLiveStreams") as EventSource[];
    const frame = {
      events: [],
      byProject: {},
      stateVersion: version,
      lastEventAt: new Date(Date.UTC(2026, 9, 31, 12, 0, version)).toISOString(),
    };
    for (const stream of streams)
      stream.dispatchEvent(
        new MessageEvent("message", {
          data: JSON.stringify(frame),
        }),
      );
  }, version);
  // Drive the transport's documented 150 ms debounce, not a navigation completion heuristic.
  await page.clock.runFor(200);
}
