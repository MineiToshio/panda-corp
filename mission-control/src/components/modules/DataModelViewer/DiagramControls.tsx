import { GraphControls } from "@/components/modules/GraphControls/GraphControls";
import { COPY } from "./copy.es";
import type { useViewport } from "./useViewport";

/** The same corner toolbar as the dependency map, with optional click-pan alternatives. */
export function DiagramControls({
  viewport,
  expanded,
  onToggleFullscreen,
}: {
  viewport: ReturnType<typeof useViewport>;
  expanded: boolean;
  onToggleFullscreen: () => void;
}) {
  return (
    <GraphControls
      prefix="model"
      scale={viewport.view.zoom}
      isFullscreen={expanded}
      onZoomIn={() => viewport.zoomBy(1.15)}
      onZoomOut={() => viewport.zoomBy(1 / 1.15)}
      onReset={viewport.reset}
      resetLabel={COPY.reset}
      onFit={viewport.fit}
      onToggleFullscreen={onToggleFullscreen}
      fullscreenId={expanded ? "model-close" : "model-fullscreen"}
      onPan={viewport.pan}
    />
  );
}
