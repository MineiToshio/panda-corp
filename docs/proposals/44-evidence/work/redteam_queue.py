"""Read queue events and report files. Compare like-for-like completed episodes."""

import json
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from statistics import median

ROOT = Path("/Users/Shared/Proyectos")
END = "2026-11-21T16:00:00"
PROJECTS = ("panda-corp/mission-control", "funko-tracker", "personal-page-v2")


def clock(row):
    return datetime.fromisoformat(row["ts"].replace("Z", "+00:00"))


episodes = []
stages = Counter()
totals = Counter()
for project in PROJECTS:
    run = ROOT / project / ".pandacorp/run"
    attempts = defaultdict(dict)
    for index, line in enumerate((run / "queue-log.jsonl").read_text().splitlines(), 1):
        row = json.loads(line)
        if row["ts"].startswith("2026-11-21") and row["ts"] < END:
            attempts[row["attempt"]][row["event"]] = row
    pending = defaultdict(list)
    for key, events in sorted(attempts.items(), key=lambda item: item[1]["start"]["ts"]):
        start = events["start"]
        branch = start["branch"]
        group = pending[branch]
        group.append(events)
        totals["invocations"] += 1
        totals["exit_" + str(events["end"]["exit"])] += 1
        if "gate_end" in events:
            end = events["gate_end"]
            totals["gates"] += 1
            totals["gate_seconds"] += end["duration_s"]
            totals["gate_reds"] += end["rc"] != 0
            path = Path(end["report"])
            if not path.is_file():
                path = run / "gate-reports" / (key + ".json")
            if path.is_file():
                for stage in json.loads(path.read_text())["subgates"]:
                    stages[stage["name"]] += stage["duration_ms"]
                totals["matched_reports"] += 1
        if events.get("ff", {}).get("result") != "ok":
            continue
        gates = [item["gate_end"]["duration_s"] for item in group if "gate_end" in item]
        wall = (clock(events["ff"]) - clock(group[0]["start"])).total_seconds()
        gaps = sum((clock(b["start"]) - clock(a["end"])).total_seconds()
                   for a, b in zip(group, group[1:]))
        record = (project.split("/")[-1], branch, len(group), len(gates), sum(gates), wall, gaps)
        print("{} {} starts={} gates={} gate_s={} elapsed_s={:.3f} inter_s={:.3f}".format(*record))
        episodes.append(record)
        del pending[branch]
    for branch, group in pending.items():
        print("OPEN", project.split("/")[-1], branch, "starts", len(group))
print("totals", dict(sorted(totals.items())))
print("stage_share", {name: round(100 * stages[name] / stages.total(), 2)
                      for name in ("playwright", "vitest")})
starts, gates, seconds, wall, gaps = map(sum, zip(*(row[2:] for row in episodes)))
print(f"closed={len(episodes)} starts={starts} gates={gates} gate_s={seconds} elapsed_s={wall:.3f} inter_s={gaps:.3f}")
print(f"gate_min_per_closed={seconds/60/len(episodes):.2f} summed_gate_share={seconds/wall:.2%} median_elapsed_min={median(row[5] for row in episodes)/60:.2f}")

# Older transcript annotations preserve both the ready and the first-queue clocks.
source = ROOT / "panda-corp/docs/proposals/43-evidence/w-tr/episodes.json"
history = [e for e in json.loads(source.read_text()) if e["project"] == "funko-tracker" and e["landed"]]
whole = sum(e["wall_s"] for e in history)
from_queue = sum(e["wall_queue_s"] for e in history)
attempt_s = sum(a.get("duration_s") or 0 for e in history for a in e["attempts"])
gap_by_result = Counter()
missing = []
for e in history:
    for a, b in zip(e["attempts"], e["attempts"][1:]):
        if a["end"] is None:
            missing.append((e["id"], a["attempt_key"]))
            continue
        kind = a["outcome"]
        if kind.startswith("rojo") or a.get("rc") == 11:
            kind = "gate red or block"
        gap_by_result[kind] += (clock(b["call"]) - clock(a["end"])).total_seconds()
print("older landed", len(history), "starts", sum(len(e["attempts"]) for e in history),
      "hours", {k: round(v / 3600, 3) for k, v in {
          "total": whole, "ready_before_call": whole - from_queue, "first_call_to_end": from_queue,
          "attempts": attempt_s, "observed_between": gap_by_result.total(),
          "unresolved": from_queue - attempt_s - gap_by_result.total()}.items()})
print("older inter-call hours by preceding result", {k: round(v / 3600, 3)
      for k, v in gap_by_result.most_common()}, "missing ends", missing)

if "--verify-report" in sys.argv:
    scratch = Path(__file__).resolve().parents[1]
    report = (scratch / "findings/redteam.md").read_text()
    assert re.findall(r"^## (\d+)\.", report, re.M) == list("12345678")
    assert re.findall(r"^### ([A-D])\.", report, re.M) == list("ABCD")
    sections = re.split(r"(?m)^## (?:\d+\.|Decision after)", report)[1:-1]
    for section in sections:
        assert re.search(r"^\*\*Verdict — (FAILS|SURVIVES WITH CHANGE|SURVIVES)\b", section, re.M)
        assert "**Design correction.**" in section
    bases = {"P": ROOT / "panda-corp", "F": ROOT / PROJECTS[1], "PP": ROOT / PROJECTS[2],
             "MC": ROOT / PROJECTS[0], "A": source.parents[1], "S": scratch,
             "T": Path("/Users/sergio/.claude/projects/-Users-Shared-Proyectos-funko-tracker")}
    citations = re.findall(r"`(MC|PP|P|F|A|S|T)/([^`:\n]+):([\d,–-]+)`", report)
    for alias, relative, numbers in citations:
        path = bases[alias] / relative
        last = max(map(int, re.findall(r"\d+", numbers)))
        with path.open("rb") as infile:
            assert any(n == last for n, _ in enumerate(infile, 1)), (path, last)
    assert [starts, gates, seconds, len(episodes)] == [18, 14, 5354, 5]
    assert [len(history), sum(len(e["attempts"]) for e in history)] == [57, 128]
    expected = [f"{seconds:,} s", f"{wall:,.3f} s", f"{gaps:,.3f} s",
                f"{(whole-from_queue)/3600:.3f}", f"{attempt_s/3600:.3f}",
                f"{gap_by_result.total()/3600:.3f}", f"{seconds/wall:.2%}",
                f"{median((row[5]-row[4])/60 for row in episodes):.2f} min"]
    assert all(value in report for value in expected), expected
    print(f"report verified: {len(sections)} attacks with verdicts and corrections; four decision sections; "
          f"{len(citations)} local line citations resolved; queue clocks and counts matched")
