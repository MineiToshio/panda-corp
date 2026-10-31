import { readTailUtf8, resolveEventSources } from "./events";

/** Usage-source availability; a line number never exposes raw stream content. */
export type EventSourceHealth =
  | { readonly ok: true }
  | { readonly ok: false; readonly kind: "missing"; readonly source: string }
  | {
      readonly ok: false;
      readonly kind: "invalid-json" | "invalid-shape";
      readonly source: string;
      readonly line: number;
    };

function lineHealth(line: string, source: string, lineNumber: number): EventSourceHealth {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return { ok: false, kind: "invalid-json", source, line: lineNumber };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    !("event" in parsed) ||
    typeof parsed.event !== "string" ||
    !("at" in parsed) ||
    typeof parsed.at !== "string"
  ) {
    return { ok: false, kind: "invalid-shape", source, line: lineNumber };
  }
  return { ok: true };
}

function streamHealth(text: string, source: string): EventSourceHealth {
  for (const [index, line] of text.split("\n").entries()) {
    if (!line.trim()) continue;
    const health = lineHealth(line, source, index + 1);
    if (!health.ok) return health;
  }
  return { ok: true };
}

/** Probe the same sources and bounded tail as readEvents, preserving its tolerant contract. */
export function eventSourceHealth(): EventSourceHealth {
  const sources = resolveEventSources(undefined);
  for (const [sourceIndex, { path }] of sources.entries()) {
    let text: string;
    try {
      text = readTailUtf8(path);
    } catch {
      if (sourceIndex === 0) return { ok: false, kind: "missing", source: path };
      continue;
    }
    const health = streamHealth(text, path);
    if (!health.ok) return health;
  }
  return { ok: true };
}
