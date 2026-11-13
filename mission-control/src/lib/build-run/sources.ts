import fs from "node:fs";
import type { BuildSourceError } from "./types";

/** Read a bounded optional source; only ENOENT means absent. Never returns raw error content. */
export function readSource(
  file: string,
  errors: BuildSourceError[],
): { raw: string; mtimeMs: number } | null {
  try {
    const fd = fs.openSync(file, "r");
    try {
      const stat = fs.fstatSync(fd);
      if (!stat.isFile() || stat.size > 4 * 1024 * 1024) throw new Error("source limit");
      return { raw: fs.readFileSync(fd, "utf8"), mtimeMs: stat.mtimeMs };
    } finally {
      fs.closeSync(fd);
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return null;
    errors.push({ path: file, reason: "No se puede leer la fuente o supera el límite de lectura" });
    return null;
  }
}
/** Parse JSON without leaking arbitrary contents or secrets into the error notice. */
export function parseJson(raw: string, file: string, errors: BuildSourceError[]): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    errors.push({ path: file, reason: "JSON malformado" });
    return undefined;
  }
}

/** Bounded UTF-8 tail shared by event and performance readers. Partial first lines are discarded. */
export function readBoundedTail(filePath: string): string {
  const MAX_TAIL_BYTES = 256 * 1024;
  const fd = fs.openSync(filePath, "r");
  try {
    const { size } = fs.fstatSync(fd);
    if (size <= MAX_TAIL_BYTES) {
      return fs.readFileSync(fd, "utf-8");
    }
    const start = size - MAX_TAIL_BYTES;
    const buf = Buffer.allocUnsafe(MAX_TAIL_BYTES);
    const bytesRead = fs.readSync(fd, buf, 0, MAX_TAIL_BYTES, start);
    const text = buf.toString("utf-8", 0, bytesRead);
    // Drop everything up to and including the first newline — the tail window
    // almost certainly starts mid-line, and that partial line is not valid JSON.
    const firstNl = text.indexOf("\n");
    return firstNl === -1 ? "" : text.slice(firstNl + 1);
  } finally {
    fs.closeSync(fd);
  }
}
