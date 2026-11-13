import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Detect writes, touches and create/remove cycles, even when a spec restores the original bytes. */
export function sharedStateFingerprint(root: string): string {
  const hash = createHash("sha256");
  function visit(file: string): void {
    const stat = fs.lstatSync(file, { bigint: true });
    hash.update(
      JSON.stringify([file, String(stat.mode), String(stat.mtimeNs), String(stat.ctimeNs)]),
    );
    if (stat.isSymbolicLink())
      throw new Error(`Read-only fixtures must not contain symlinks: ${file}`);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(file).sort()) visit(path.join(file, name));
    } else if (stat.isFile()) hash.update(fs.readFileSync(file));
    else throw new Error(`Unsupported read-only fixture: ${file}`);
  }
  visit(root);
  return hash.digest("hex");
}

function isLedgerAction(entry: unknown): boolean {
  return (
    !!entry &&
    typeof entry === "object" &&
    "filename" in entry &&
    typeof entry.filename === "string" &&
    /(?:^|\/)src\/app\/_actions\/snapshotLedger\.ts$/.test(entry.filename) &&
    "exportedName" in entry &&
    entry.exportedName === "snapshotGamificationLedger"
  );
}

/** Resolve the one isolated background action from the RUNNING build, never from a hardcoded id. */
export function ledgerActionIds(manifest: unknown): readonly string[] {
  const ids: string[] = [];
  if (!manifest || typeof manifest !== "object") throw new Error("Invalid action manifest");
  for (const runtime of Object.values(manifest)) {
    if (!runtime || typeof runtime !== "object") continue;
    for (const [id, entry] of Object.entries(runtime)) {
      if (isLedgerAction(entry)) ids.push(id);
    }
  }
  if (ids.length === 0)
    throw new Error("Cannot identify the isolated ledger action in the running manifest");
  return ids;
}

/** Only GET/HEAD/OPTIONS and the explicitly isolated ledger action may occur in read-only UI tests. */
export function classifyRequest(input: {
  method: string;
  url: string;
  origin: string;
  action: string | undefined;
  ledgerIds: () => readonly string[];
}): "read" | "isolated-ledger" | "forbidden" {
  if (["GET", "HEAD", "OPTIONS"].includes(input.method)) return "read";
  if (
    input.method === "POST" &&
    new URL(input.url).origin === input.origin &&
    input.action &&
    input.ledgerIds().includes(input.action)
  )
    return "isolated-ledger";
  return "forbidden";
}
