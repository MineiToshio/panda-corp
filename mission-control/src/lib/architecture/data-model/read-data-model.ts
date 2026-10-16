/** Server-only filesystem boundary; client consumers import types/model without Node dependencies. */
import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { validateDataModel } from "./model";
import { DATA_MODEL_SOURCE, type DataModelResult, MAX_DATA_MODEL_BYTES } from "./types";

function readBoundedJson(descriptor: number): DataModelResult {
  const stats = fstatSync(descriptor);
  if (!stats.isFile())
    return { kind: "error", message: "Data model source is not a regular file." };
  if (stats.size > MAX_DATA_MODEL_BYTES)
    return { kind: "error", message: "Data model exceeds the 1 MiB size limit." };
  // A sentinel byte also catches growth between stat and read without allocating unbounded input.
  const buffer = Buffer.alloc(MAX_DATA_MODEL_BYTES + 1);
  let count = 0;
  while (count < buffer.length) {
    const read = readSync(descriptor, buffer, count, buffer.length - count, null);
    if (read === 0) break;
    count += read;
  }
  if (count > MAX_DATA_MODEL_BYTES)
    return { kind: "error", message: "Data model exceeds the 1 MiB size limit." };
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, count)));
  } catch {
    return { kind: "error", message: "Data model is not valid UTF-8 JSON." };
  }
  return validateDataModel(raw);
}

/** Read only the canonical bounded JSON artifact; distinguish absence from malformed or unreadable input. */
export function readDataModel(projectPath: string): DataModelResult {
  let descriptor: number | undefined;
  try {
    // Nonblocking open prevents a malformed named pipe from stalling the server before fstat.
    descriptor = openSync(
      join(projectPath, DATA_MODEL_SOURCE),
      constants.O_RDONLY | constants.O_NONBLOCK,
    );
    return readBoundedJson(descriptor);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { kind: "missing" };
    }
    return { kind: "error", message: "Unable to read the data model source." };
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
