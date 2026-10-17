import type { DataModelEntity } from "@/lib/architecture/data-model/types";

export const HEADER_HEIGHT = 38;
export const ROW_HEIGHT = 24;

/** Conservative monospace advance, including full-width Unicode, at the viewer's 12px font. */
function textWidth(value: string): number {
  return [...value].reduce(
    (width, glyph) => width + ((glyph.codePointAt(0) ?? 0) > 0x2ff ? 16 : 8),
    0,
  );
}

/** Content-sized columns shared by graph geometry and the rendered table. */
export function entityGeometry(entity: DataModelEntity) {
  const name = Math.max(64, ...entity.attributes.map((field) => textWidth(field.name))) + 24;
  const type = Math.max(48, ...entity.attributes.map((field) => textWidth(field.type))) + 24;
  const columns = [name, type, 80, 28];
  return {
    columns,
    width: Math.max(
      columns.reduce((sum, value) => sum + value, 0),
      textWidth(entity.name) + 64,
    ),
    height: HEADER_HEIGHT + ROW_HEIGHT * entity.attributes.length,
  };
}
