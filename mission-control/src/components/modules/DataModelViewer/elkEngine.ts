import type { ElkNode } from "elkjs/lib/elk-api";

/** ELK's thin browser API talks directly to its algorithm worker; Node hosts use its bundled adapter. */
export async function routeGraph(graph: ElkNode, signal?: AbortSignal): Promise<ElkNode> {
  const usesWorker = typeof Worker !== "undefined";
  const elk = !usesWorker
    ? new (await import("elkjs/lib/elk.bundled.js")).default()
    : new (await import("elkjs/lib/elk-api.js")).default({
        workerFactory: () =>
          new Worker(new URL("elkjs/lib/elk-worker.min.js", import.meta.url), { type: "module" }),
      });
  if (signal?.aborted) {
    if (usesWorker) elk.terminateWorker();
    throw new DOMException("Layout cancelled", "AbortError");
  }
  let rejectCancelled: (reason: Error) => void = () => {};
  const cancelled = new Promise<never>((_resolve, reject) => {
    rejectCancelled = reject;
  });
  function abort() {
    if (usesWorker) elk.terminateWorker();
    rejectCancelled(new DOMException("Layout cancelled", "AbortError"));
  }
  signal?.addEventListener("abort", abort, { once: true });
  try {
    return await Promise.race([elk.layout<ElkNode>(graph), cancelled]);
  } finally {
    signal?.removeEventListener("abort", abort);
    if (usesWorker) elk.terminateWorker();
  }
}
