import { useEffect, useState } from "react";
import type { DataModel } from "@/lib/architecture/data-model/types";
import { layoutModel, type ModelLayout } from "./layout";

type LayoutResult =
  | { kind: "loading" }
  | { kind: "ready"; layout: ModelLayout }
  | { kind: "error" };

/** Isolate asynchronous geometry by model identity, timeout and worker cancellation. */
export function useModelLayout(model: DataModel): LayoutResult {
  const modelKey = JSON.stringify(model);
  const [state, setState] = useState<{ modelKey: string; result: LayoutResult } | null>(null);
  useEffect(() => {
    // Deserialize only for a new payload's content, keeping equal RSC refreshes off the layout path.
    const layoutInput: DataModel = JSON.parse(modelKey);
    let active = true;
    const controller = new AbortController();
    function settle(result: LayoutResult) {
      if (!active) return;
      active = false;
      clearTimeout(timeout);
      setState({ modelKey, result });
    }
    const timeout = setTimeout(() => {
      settle({ kind: "error" });
      controller.abort();
    }, 20_000);
    void layoutModel(layoutInput, controller.signal).then(
      (layout) => settle({ kind: "ready", layout }),
      () => settle({ kind: "error" }),
    );
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [modelKey]);
  return state?.modelKey === modelKey ? state.result : { kind: "loading" };
}
