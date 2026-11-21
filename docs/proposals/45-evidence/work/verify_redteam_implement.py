"""Read-only reproduction of report acceptance checks. Run from the scratchpad."""
import collections
import datetime
import json
from pathlib import Path
import re
import subprocess

project = Path("/Users/Shared/Proyectos/funko-tracker")
factory = project.parent / "panda-corp"
claude = Path.home() / ".claude/projects"
report = Path("audit/redteam.md").read_text()


def git(repo, *args):
    return subprocess.check_output(["git", "-C", str(repo), *args], text=True)


def read_rows(path):
    with path.open() as file:
        return [json.loads(line) for line in file]


def time(value):
    return datetime.datetime.fromisoformat(value.replace("Z", "+00:00"))


patterns = [
    ".pandacorp/run/build*/journal.jsonl",
    ".pandacorp/run/build*/*/journal.jsonl",
    ".claude/worktrees/*/.pandacorp/run/build/journal.jsonl",
]
journals = [read_rows(f) for pattern in patterns for f in project.glob(pattern)]
journals.sort(key=lambda rows: rows[0]["at"])
assert len({rows[0]["run_id"] for rows in journals}) == len(journals) == 8
assert sorted(rows[0]["data"]["state"]["size"] for rows in journals) == ["feature"] * 5 + ["giant"] * 3
risk = collections.Counter()
counts = []
for index, rows in enumerate(journals, 1):
    units = {r["data"]["id"]: r["data"]["zone"] for r in rows
             if r["type"] == "unit_queued" and r["data"]["kind"] == "build"}
    dispatches = [r["data"]["unit"] for r in rows if r["type"] == "unit_dispatched"]
    risk.update(units[unit] for unit in dispatches if unit in units)
    shas = [r["data"]["sha"] for r in rows if r["type"] == "integrated"]
    reachable = 0
    for sha in shas:
        rc = subprocess.run(["git", "-C", project, "merge-base", "--is-ancestor",
                             sha, "cedefd9f"]).returncode
        assert rc in (0, 1)
        reachable += rc == 0
    counts.append((len(dispatches), len(shas), reachable))
    expected_row = f" | {len(dispatches)} / {len(shas)} / {reachable} | "
    assert any(line.startswith(f"| N{index},") and expected_row in line
               for line in report.splitlines())
assert sum(row[1] for row in counts) == 22 and sum(row[2] for row in counts) == 12
assert risk == {"floor": 17, "r1": 2}
print("8 CLI journals and report rows match; 12/22 tips reachable; 19 build dispatches, none zone none.")

calls = []
directories = []
for stem in ("d812059e", "4dac9675", "62d4cf83"):
    path, = claude.glob(f"*/{stem}*.jsonl")
    ids = set()
    with path.open() as file:
        for line in file:
            if '"Workflow"' not in line or '"scriptPath"' not in line:
                continue
            record = json.loads(line)
            if record.get("type") != "assistant":
                continue
            for block in record["message"]["content"]:
                if not isinstance(block, dict):
                    continue
                if block.get("type") == "tool_use" and block.get("name") == "Workflow":
                    if "pandacorp-build" in block["input"].get("scriptPath", ""):
                        ids.add(block["id"])
    calls.append(len(ids))
    directories.append(len(list(path.with_suffix("").glob("subagents/workflows/*/journal.jsonl"))))
assert calls == [5, 1, 6] and directories == [5, 1, 5]
print("12 legacy activations, 11 workflow directories; excluding diagnostic gives 19 delivery activations / 18 IDs including CLI.")

categories = collections.defaultdict(collections.Counter)
ledger = Path("audit/failures.md").read_text().splitlines()
for line in ledger[70:134]:
    _, row, category, _, hits, *_ = line.split("|")
    categories[row.strip()[0]][category.strip()] += int(hits)
assert sum(categories["N"].values()) == 57 and sum(categories["L"].values()) == 34
report_rows = re.findall(r"^\| [^|]+ \| (\d+) \| (\d+) \| (\d+) \|", report, re.M)
for key, row in zip("abcdefghij", report_rows, strict=True):
    cli, legacy, total = map(int, row)
    assert cli == categories["N"][key] and legacy == categories["L"][key] and total == cli + legacy
print("64 ledger rows, all ten report class totals reconcile: 57 CLI + 34 legacy = 91.")

clocks = []
failures = 0
for path in claude.glob("*bench*vanilla/*.jsonl"):
    rows = read_rows(path)
    start = next(row for row in rows if row.get("type") == "user")
    end = [row for row in rows if row.get("type") == "assistant"][-1]
    if end["message"]["model"] == "<synthetic>":
        failures += 1
        continue
    assert end["message"]["model"] == "claude-sonnet-5-5"
    clocks.append(round((time(end["timestamp"]) - time(start["timestamp"])).total_seconds() / 60, 2))
assert sorted(clocks) == [2.54, 5.46, 11.45, 12.06] and failures == 1
assert all(str(clock) in report for clock in clocks)
print("Four direct transcript clocks reproduced; separate synthetic login failure confirmed.")

work_orders = "docs/frds/frd-06-franchise-backfill/work-orders"
def planned(rev):
    files = git(project, "ls-tree", "-r", "--name-only", rev, "--", work_orders)
    return re.findall(r"/wo-06-01[0-3]-", files)
assert len(planned("9177c74f")) == 4 and not planned("d94a6e3a")
queue = read_rows(project / ".pandacorp/run/queue-log.jsonl")
assert queue[82]["event"] == "gate_end" and queue[82]["rc"] == 0
assert queue[85]["exit"] == 21
assert any(row.get("event") == "push" and row.get("result") == "ok"
           and row.get("sha", "").startswith("d94a6e3a") for row in queue[109:120])
assert all(rows[0]["data"]["preflight"]["announce"]["risk_zone_provisional"] == "floor"
           for rows in journals[-2:])
print("Catalog: 4 planned WO files, 0 in pushed tree; 2 giant/floor starts, hold and push receipts confirmed.")

runtime = git(factory, "ls-tree", "-r", "--name-only", "3105fd55", "--", "plugin/runtime/build")
modules = [name for name in runtime.splitlines() if name.endswith(".mjs")]
physical_lines = sum(len(git(factory, "show", f"3105fd55:{name}").splitlines()) for name in modules)
commits = git(factory, "log", "3105fd55", "--since=2026-09-23T00:00:00-05:00",
              "--until=2026-11-22T00:00:00-05:00", "--format=%H", "--",
              "plugin/runtime/build", "plugin/skills/implement").splitlines()
assert (len(modules), physical_lines, len(set(commits))) == (166, 19371, 104)
print("Factory snapshot: 166 modules, 19,371 lines, 104 union-history commits.")

verdicts = re.findall(r"^## ([1-8])\. .* — (?:SURVIVES WITH CHANGE|SURVIVES|FAILS)\b", report, re.M)
assert verdicts == list("12345678")
assert re.findall(r"^## \(([a-d])\)", report, re.M) == list("abcd")
assert len(re.findall(r"^```text\n.*?^```$", report, re.M | re.S)) == 2
assert report.endswith("```\n")
assert all(word in report for word in ("inconclusive", "Rollback", "cold recovery", "authority", "ESTIMATED", "MEASURED"))
print("Deliverable: 8 verdicts, 4 closing sections, 2 complete prompts, uncertainty and acceptance conditions present.")
