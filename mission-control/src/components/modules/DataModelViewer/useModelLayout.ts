import { useEffect, useState } from "react";
import type { DataModel } from "@/lib/architecture/data-model/types";
import { layoutModel, type ModelLayout } from "./layout";

type LayoutResult =
  | { kind: "loading" }
  | { kind: "ready"; layout: ModelLayout }
  | { kind: "error" };

/** Isolate asynchronous geometry by model identity, timeout and worker cancellation. */
export function useModelLayout(model: DataModel): LayoutResult {
  const [state, setState] = useState<{ model: DataModel; result: LayoutResult } | null>(null);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    function settle(result: LayoutResult) {
      if (!active) return;
      active = false;
      clearTimeout(timeout);
      setState({ model, result });
    }
    const timeout = setTimeout(() => {
      settle({ kind: "error" });
      controller.abort();
    }, 20_000);
    void layoutModel(model, controller.signal).then(
      (layout) => settle({ kind: "ready", layout }),
      () => settle({ kind: "error" }),
    );
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [model]);
  return state?.model === model ? state.result : { kind: "loading" };
}
