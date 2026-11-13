import fs from "node:fs";
import path from "node:path";
import { resolveFactoryRoot } from "../config/config";
import { parseSchema, type Schema } from "./schema";
import type { BuildSourceError } from "./types";

const schemas = new Map<
  string,
  { mtimeMs: number; ctimeMs: number; size: number; schema: Schema }
>();

/** Server-only filesystem boundary: schemas stay in the factory, including snapshot deployments.
 * Cache successful parses by source identity; failed reads are retried and remain visible errors.
 */
export function readBuildSchema(
  name: "state" | "perf-record",
  errors: BuildSourceError[],
): Schema | null {
  const factoryRoot = resolveFactoryRoot();
  const file = path.join(factoryRoot, "plugin/runtime/build/schemas", `${name}.schema.json`);
  try {
    const root = fs.realpathSync(factoryRoot);
    const physicalFile = fs.realpathSync(file);
    const relative = path.relative(root, physicalFile);
    if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      errors.push({ path: file, reason: "El esquema está fuera de la raíz física de la fábrica" });
      return null;
    }
    const { mtimeMs, ctimeMs, size } = fs.statSync(physicalFile);
    const cached = schemas.get(physicalFile);
    if (cached && cached.mtimeMs === mtimeMs && cached.ctimeMs === ctimeMs && cached.size === size)
      return cached.schema;
    const schema = parseSchema(JSON.parse(fs.readFileSync(physicalFile, "utf8")));
    schemas.set(physicalFile, { mtimeMs, ctimeMs, size, schema });
    return schema;
  } catch {
    errors.push({ path: file, reason: "No se puede leer un esquema válido del motor de builds" });
    return null;
  }
}
