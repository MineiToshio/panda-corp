import { t } from "@/lib/copy/copy";
/** Shared Spanish graph-navigation copy. */
export const GRAPH_COPY = {
  zoomOut: t("workspace.arquitectura.dataModel.zoomOut"),
  zoomIn: t("workspace.arquitectura.dataModel.zoomIn"),
  reset: t("workspace.arquitectura.dataModel.reset"),
  level: (pct: string, reset: string) => `Zoom ${pct} · ${reset}`,
  fit: t("workspace.arquitectura.dataModel.fit"),
  fitTitle: t("workspace.arquitectura.dataModel.fit"),
  fullscreen: t("workspace.arquitectura.dataModel.fullscreen"),
  exitFullscreen: "Salir de pantalla completa",
  pan: "Mover diagrama",
  left: "Mover a la izquierda",
  right: "Mover a la derecha",
  up: "Mover arriba",
  down: "Mover abajo",
} as const;
