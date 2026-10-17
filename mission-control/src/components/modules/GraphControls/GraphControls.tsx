"use client";

import { useState } from "react";
import { GRAPH_COPY } from "./copy.es";
import styles from "./graphControls.module.css";

interface GraphControlsProps {
  scale: number;
  isFullscreen: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
  onToggleFullscreen: () => void;
  prefix: string;
  resetLabel?: string;
  fullscreenId?: string;
  onPan?: (x: number, y: number) => void;
}

/** One corner toolbar for graph zoom/fit/fullscreen; optional click-pan alternatives stay collapsed. */
export function GraphControls({
  scale,
  isFullscreen,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
  onToggleFullscreen,
  prefix,
  resetLabel = GRAPH_COPY.reset,
  fullscreenId,
  onPan,
}: GraphControlsProps): React.JSX.Element {
  const [panOpen, setPanOpen] = useState(false);
  const pct = `${Math.round(scale * 100)}%`;
  const fullscreenLabel = isFullscreen ? GRAPH_COPY.exitFullscreen : GRAPH_COPY.fullscreen;
  return (
    <div className={styles.bar} data-testid={`${prefix}-zoom`}>
      <button
        type="button"
        data-testid={`${prefix}-zoom-out`}
        aria-label={GRAPH_COPY.zoomOut}
        title={GRAPH_COPY.zoomOut}
        onClick={onZoomOut}
      >
        <i className="ti ti-zoom-out" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.level}
        data-testid={`${prefix}-zoom-level`}
        aria-label={GRAPH_COPY.level(pct, resetLabel)}
        title={resetLabel}
        onClick={onReset}
      >
        {pct}
      </button>
      <button
        type="button"
        data-testid={`${prefix}-zoom-in`}
        aria-label={GRAPH_COPY.zoomIn}
        title={GRAPH_COPY.zoomIn}
        onClick={onZoomIn}
      >
        <i className="ti ti-zoom-in" aria-hidden="true" />
      </button>
      <button
        type="button"
        data-testid={`${prefix}-zoom-fit`}
        aria-label={GRAPH_COPY.fit}
        title={GRAPH_COPY.fitTitle}
        onClick={onFit}
      >
        <i className="ti ti-zoom-scan" aria-hidden="true" />
      </button>
      {onPan && (
        <button
          type="button"
          aria-label={GRAPH_COPY.pan}
          title={GRAPH_COPY.pan}
          aria-expanded={panOpen}
          onClick={() => setPanOpen((open) => !open)}
        >
          <i className="ti ti-arrows-move" aria-hidden="true" />
        </button>
      )}
      <span className={styles.divider} aria-hidden="true" />
      <button
        type="button"
        data-testid={fullscreenId ?? `${prefix}-fullscreen`}
        aria-label={fullscreenLabel}
        title={fullscreenLabel}
        aria-pressed={isFullscreen}
        onClick={onToggleFullscreen}
      >
        <i className={`ti ${isFullscreen ? "ti-minimize" : "ti-maximize"}`} aria-hidden="true" />
      </button>
      {onPan && panOpen && (
        <div className={styles.panPad}>
          <button
            type="button"
            className={styles.up}
            aria-label={GRAPH_COPY.up}
            onClick={() => onPan(0, 64)}
          >
            <i className="ti ti-arrow-up" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.left}
            aria-label={GRAPH_COPY.left}
            onClick={() => onPan(64, 0)}
          >
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.down}
            aria-label={GRAPH_COPY.down}
            onClick={() => onPan(0, -64)}
          >
            <i className="ti ti-arrow-down" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.right}
            aria-label={GRAPH_COPY.right}
            onClick={() => onPan(-64, 0)}
          >
            <i className="ti ti-arrow-right" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
