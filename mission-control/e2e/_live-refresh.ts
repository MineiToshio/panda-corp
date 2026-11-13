import fs from "node:fs";
import type { Page } from "@playwright/test";

type LiveObservation = {
  source: EventSource;
  url: string;
  frames: number;
  firstFrameAt: number | null;
  version?: number;
};

/** Observe native SSE, never replace the real server/watchers with fabricated frames. */
export async function observeProjectLive(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const Native = window.EventSource;
    const records: LiveObservation[] = [];
    Reflect.set(window, "projectLiveObservations", records);
    window.EventSource = class extends Native {
      constructor(url: string | URL, options?: EventSourceInit) {
        super(url, options);
        const record: LiveObservation = {
          source: this,
          url: String(url),
          frames: 0,
          firstFrameAt: null,
        };
        records.push(record);
        this.addEventListener("message", (event) => {
          record.frames += 1;
          try {
            const frame = JSON.parse(event.data);
            if (typeof frame.stateVersion === "number" && Number.isFinite(frame.stateVersion)) {
              record.firstFrameAt ??= performance.now();
              record.version = frame.stateVersion;
            }
          } catch {
            // Preserve malformed transport diagnostics; the product still judges the payload.
          }
        });
      }
    };
  });
}

/** Wait for a committed project baseline, then prove a real filesystem change causes an RSC refresh. */
export async function refreshFromProjectChange(
  page: Page,
  file: string,
  project: string,
): Promise<void> {
  const original = fs.statSync(file);
  let touched = false;
  const rscObserved: { url: string; start: number; prefetch: boolean }[] = [];
  try {
    await page.waitForFunction(
      (project) => {
        const records = Reflect.get(window, "projectLiveObservations") as
          | LiveObservation[]
          | undefined;
        return records?.some(
          (record) =>
            new URL(record.url, location.href).searchParams.get("project") === project &&
            record.source.readyState === EventSource.OPEN &&
            record.firstFrameAt !== null &&
            // useLiveSnapshot debounces 150 ms: let the first version establish its baseline.
            performance.now() - record.firstFrameAt >= 300,
        );
      },
      project,
      { timeout: 5_000 },
    );
    const location = new URL(page.url());
    const startedAt = Date.now();
    // Arm BEFORE touching; exclude prefetches and requests already in flight from navigation.
    const refreshed = page
      .waitForResponse(
        (response) => {
          const request = response.request();
          const headers = request.headers();
          const target = new URL(response.url());
          if (headers.rsc === "1") {
            rscObserved.push({
              url: response.url(),
              start: request.timing().startTime,
              prefetch: "next-router-prefetch" in headers,
            });
            if (rscObserved.length > 10) rscObserved.shift();
          }
          return (
            headers.rsc === "1" &&
            !("next-router-prefetch" in headers) &&
            request.timing().startTime >= startedAt &&
            target.pathname === location.pathname &&
            ["view", "dag", "frd", "focus"].every(
              (key) => target.searchParams.get(key) === location.searchParams.get(key),
            )
          );
        },
        { timeout: 12_000 },
      )
      .then(
        (response) => ({ response, error: null }),
        (error: unknown) => ({ response: null, error }),
      );
    for (;;) {
      const next = new Date(Math.max(Date.now(), fs.statSync(file).mtimeMs + 1));
      fs.utimesSync(file, original.atime, next);
      touched = true;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let outcome: Awaited<typeof refreshed> | null;
      try {
        // A reconnect can re-baseline on a missed change. Keep exercising the real watcher,
        // bounded by ONE response timeout, never by retrying a failed test.
        outcome = await Promise.race([
          refreshed,
          new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), 3_000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
      if (!outcome) continue;
      if (outcome.error) throw outcome.error;
      if (!outcome.response?.ok())
        throw new Error("Production live refresh returned a non-2xx response");
      return;
    }
  } catch (error) {
    const observations = await page
      .evaluate(() =>
        (Reflect.get(window, "projectLiveObservations") as LiveObservation[] | undefined)?.map(
          (r) => ({
            url: r.url,
            readyState: r.source.readyState,
            frames: r.frames,
            version: r.version,
          }),
        ),
      )
      .catch(() => "unavailable");
    throw new Error(
      `Live refresh failed: ${String(error)}; SSE=${JSON.stringify(observations)}; RSC=${JSON.stringify(rscObserved)}`,
      { cause: error },
    );
  } finally {
    if (touched) fs.utimesSync(file, original.atime, original.mtime);
  }
}
