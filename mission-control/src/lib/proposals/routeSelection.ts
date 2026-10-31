import { now } from "@/lib/clock/clock";
import type { ProposalsData } from "./data";
import { resolveOwnerActions } from "./ownerActions";
/** Exact path grammar and identity checks: an unknown location never opens a different record. */
export function validProposalsSegments(segments: readonly string[], data: ProposalsData): boolean {
  const [tab, stream, id] = segments;
  if (!segments.length || segments.length > 3 || segments.some((x) => x.length > 200)) return false;
  if (tab === "resumen") return segments.length === 1;
  if (tab === "backlog")
    return (
      segments.length === 1 ||
      (segments.length === 2 && data.backlog.items.some((x) => x.id === stream))
    );
  if (tab !== "memory") return false;
  if (segments.length === 1) return true;
  if (!["promotions", "candidate-lesson", "prune"].includes(stream ?? "")) return false;
  if (segments.length === 2) return true;
  const lesson = data.lessons.find((item) => item.id === id);
  if (!lesson) return false;
  if (stream === "promotions")
    return resolveOwnerActions(data, now()).waitingLessons.some((item) => item.id === id);
  return stream === "prune" ? lesson.status === "deprecated" : lesson.status === "candidate";
}
