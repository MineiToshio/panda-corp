/** Shared Spanish graph-navigation copy. */
export const GRAPH_COPY = {
  zoomOut: "Alejar",
  zoomIn: "Acercar",
  reset: "Restablecer a 100%",
  level: (pct: string, reset: string) => `Zoom ${pct} — ${reset}`,
  fit: "Ajustar el grafo a la vista",
  fitTitle: "Ajustar a la vista",
  fullscreen: "Ver en pantalla completa",
  exitFullscreen: "Salir de pantalla completa",
  pan: "Mover diagrama",
  left: "Mover a la izquierda",
  right: "Mover a la derecha",
  up: "Mover arriba",
  down: "Mover abajo",
} as const;
