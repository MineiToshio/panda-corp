/** Spanish copy for the read-only architecture model viewer. */
export const COPY = {
  diagram: "Diagrama",
  schema: "Esquema",
  views: "Vista del modelo",
  search: "Buscar tabla o atributo",
  noResults: "Sin coincidencias",
  source: "Modelo diseñado. Implementación sin verificar.",
  relational: "Relacional",
  document: "Documental",
  missing: "Todavía no hay un modelo de datos publicado.",
  none: "Este proyecto no usa base de datos.",
  error: "No se pudo leer el modelo de datos.",
  empty: "El modelo publicado no contiene entidades.",
  expand: "Ampliar modelo",
  close: "Cerrar modelo",
  title: "Modelo de datos",
  zoomIn: "Acercar",
  zoom: "Zoom",
  zoomOut: "Alejar",
  fit: "Ajustar",
  reset: "Restablecer",
  canvas: "Diagrama del modelo de datos",
  help: "Arrastra el fondo para moverte. Usa la rueda para acercar o alejar, o las flechas y los controles.",
  left: "Mover a la izquierda",
  right: "Mover a la derecha",
  up: "Mover arriba",
  down: "Mover abajo",
  select: "Seleccionar entidad",
  relation: "Ver relación",
  relationships: "Relaciones",
  inspect: "Selecciona una entidad o una relación para explorar sus vínculos.",
  noRelationships: "Sin relaciones declaradas.",
  optional: "Opcional",
  required: "Obligatorio",
  fields: "Atributos",
  type: "Tipo",
  keys: "Claves",
  value: "Valor",
  keyLegend: "PK: clave primaria · FK: clave foránea · UQ: valor único · ?: opcional",
  matches: (count: number) =>
    `${count} ${count === 1 ? "entidad encontrada" : "entidades encontradas"}`,
  endpoint: (min: number, max: number | "many") =>
    max === "many"
      ? min === 0
        ? "cero o más"
        : "uno o más"
      : min === 0
        ? "cero o uno"
        : "exactamente uno",
  direction: (from: string, to: string, count: string) =>
    `Cada ${from} se relaciona con ${count} de ${to}.`,
} as const;
