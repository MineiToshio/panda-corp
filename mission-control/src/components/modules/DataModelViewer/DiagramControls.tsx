import { Button } from "@/components/core/Button/Button";
import { COPY } from "./copy.es";
import type { useViewport } from "./useViewport";
import styles from "./viewer.module.css";

/** Compact graph actions, floating over the diagram when expanded. */
export function DiagramControls({ viewport }: { viewport: ReturnType<typeof useViewport> }) {
  return (
    <div className={styles.diagramControls}>
      <div className={styles.controlsGroup}>
        <Button size="sm" ariaLabel={COPY.zoomOut} onClick={() => viewport.zoomBy(1 / 1.2)}>
          −
        </Button>
        <output aria-label={COPY.zoom}>{Math.round(viewport.view.zoom * 100)}%</output>
        <Button size="sm" ariaLabel={COPY.zoomIn} onClick={() => viewport.zoomBy(1.2)}>
          +
        </Button>
        <Button size="sm" onClick={viewport.fit}>
          {COPY.fit}
        </Button>
        <Button size="sm" onClick={viewport.reset}>
          {COPY.reset}
        </Button>
      </div>
      <div className={styles.controlsGroup}>
        <Button size="sm" ariaLabel={COPY.left} onClick={() => viewport.pan(64, 0)}>
          ←
        </Button>
        <Button size="sm" ariaLabel={COPY.up} onClick={() => viewport.pan(0, 64)}>
          ↑
        </Button>
        <Button size="sm" ariaLabel={COPY.down} onClick={() => viewport.pan(0, -64)}>
          ↓
        </Button>
        <Button size="sm" ariaLabel={COPY.right} onClick={() => viewport.pan(-64, 0)}>
          →
        </Button>
      </div>
    </div>
  );
}
