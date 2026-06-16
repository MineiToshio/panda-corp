import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "vitest";
import { readActivityLog, readDecisions } from "./docs";

function mk(c: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "probe-"));
  fs.mkdirSync(path.join(d, ".pandacorp", "inbox"), { recursive: true });
  fs.writeFileSync(path.join(d, ".pandacorp", "inbox", "decisions.md"), c);
  return d;
}
function mkp(c: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "probe-"));
  fs.mkdirSync(path.join(d, ".pandacorp", "comms"), { recursive: true });
  fs.writeFileSync(path.join(d, ".pandacorp", "comms", "progress.md"), c);
  return d;
}
const log = (k: string, v: unknown) => process.stderr.write(`${k}::${JSON.stringify(v)}\n`);

describe("probe", () => {
  it("dumps", () => {
    log(
      "MULTI_REC",
      readDecisions(mk("## OPEN: t\n- **Recommendation:** first\n- **Recommendation:** second\n")),
    );
    log("EOF_NONL", readDecisions(mk("## OPEN: last block no newline")));
    log("FENCED", readActivityLog(mkp("# L\n```\n- not a real entry\n```\n- real entry\n")));
    log("HR", readActivityLog(mkp("# L\n---\n- entry\n")));
    log("DUP", readDecisions(mk("## OPEN: same\n- c\n\n## CLOSED: same\n- c\n")));
    log("EMPTY_REC", readDecisions(mk("## OPEN: t\n- **Recommendation:**\n")));
  });
});
