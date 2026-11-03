import { expect, type Page, type Response } from "@playwright/test";

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
  let response: Response | undefined;
  void refreshed.then((value) => {
    response = value;
  });
  for (let next = version; !response; next += 1) {
    await emitLiveFrame(page, next);
    await Promise.race([refreshed, new Promise((resolve) => setTimeout(resolve, RE_EMIT_MS))]);
  }
  return response;
}
