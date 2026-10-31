"use server";
import { revalidatePath } from "next/cache";
import { type DiscardBacklogResult, discardBacklogItem } from "@/lib/backlog/discard-backlog";
/** Public POST boundary: reject malformed input before the sole bounded write. */
export async function discardBacklogAction(
  id: unknown,
  reason?: unknown,
): Promise<DiscardBacklogResult> {
  if (typeof id !== "string" || !/^BL-\d+$/.test(id)) return { ok: false, reason: "not-found" };
  if (
    reason !== undefined &&
    reason !== null &&
    (typeof reason !== "string" || reason.length > 500)
  )
    return { ok: false, reason: "parse-error" };
  try {
    const result = discardBacklogItem(id, typeof reason === "string" ? reason.trim() : undefined);
    if (result.ok) revalidatePath("/proposals");
    return result;
  } catch {
    return { ok: false, reason: "parse-error" };
  }
}
