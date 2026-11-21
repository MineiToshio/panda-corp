from collections import Counter
from pathlib import Path
import re

scratch = Path.cwd()
factory = Path("/Users/Shared/Proyectos/panda-corp")
runtime = factory / "plugin/runtime/build"
audit = scratch / "audit"
proposal = audit / "synthesis.md"
draft = proposal.read_text()
failures = (audit / "failures.md").read_text()
anatomy = (audit / "anatomy.md").read_text()
prompts = (audit / "prompts.md").read_text()
memo = (factory / "docs/proposals/44-verification-strategy.md").read_text()
redteam = (factory / "docs/proposals/44-evidence/redteam.md").read_text()

sections = (
    "Diagnosis", "Why the direct prompt won on time", "Three designs",
    "Recommendation and ready-to-use prompts", "Acceptance experiment",
    "Losses, decision triggers and migration",
)
assert re.findall(r"^## \d\. (.+)$", draft, re.M) == list(sections)
assert re.findall(r"^### ([ABC])\. ", draft, re.M) == ["A", "B", "C"]
blocks = re.findall(r"^\x60{3}text\n(.*?)^\x60{3}$", draft, re.M | re.S)
assert len(blocks) == 2 and draft.count("\x60" * 3) == 4
for block, required in zip(blocks, (
    ("accepted outcome", "What must work", "Proof to collect", "expected assertion failure",
     "Production access", "Status —", "Outcome —", "Evidence —", "Open —"),
    ("accepted outcome", "pinned diff", "required evidence", "expected versus observed",
     "production access", "Verdict —", "Proof —", "Findings —"),
)):
    assert all(item in block for item in required)
    assert block.count("[") == block.count("]")
assert "full rebased queue certification" in draft and "Mission Control browser checks stay blocking" in draft
assert "any lighter landing selector" in draft.lower()
assert "original red" in draft and "protected controls" in draft
assert "36 executions" in draft and 2 * 12 + 3 * 4 == 36
assert all(line.rstrip() == line for line in draft.splitlines())
assert draft.endswith("\n")
print("Structure, prompts, source-policy commitments and 36-run plan: PASS")

for table in re.findall(r"(?:^\|.*\|$\n?)+", draft, re.M):
    rows = table.splitlines()
    assert len(rows) > 2 and len({row.count("|") for row in rows}) == 1
    assert re.fullmatch(r"[| \-:]+", rows[1])
print("Markdown tables and fences: PASS")

rows = re.findall(r"^\| [NL][^|]*\| ([a-j]) \| [^|]*\| (\d+) \|", failures, re.M)
raw = Counter()
for category, hits in rows:
    raw[category] += int(hits)
assert len(rows) == 64 and sum(raw.values()) == 91
assert list(raw[k] for k in "abcdefghij") == [13, 5, 9, 16, 8, 14, 12, 5, 6, 3]
cross_tool = 3
cross_handoff = 2
grouped = (
    raw["a"] + raw["e"], raw["b"] + raw["f"], raw["c"] + raw["g"] - cross_tool,
    raw["d"], cross_tool + cross_handoff, raw["h"], raw["i"] - cross_handoff, raw["j"],
)
assert sum(grouped) == 91
for hits in (*grouped, raw["a"], raw["b"], raw["e"], raw["f"], raw["g"], raw["c"] - cross_tool):
    assert f"{hits} ({100 * hits / 91:.2f}%)" in draft
assert "0/19 observed delivery attempts" in failures and "0/19 MEASURED" in draft
assert "89m 37s" in anatomy and "89m 37s" in draft
assert "71m 32s" in failures and "71m 32s" in draft
for claim in ("7.2", "10.7", "19.6", "23.0", "43.5", "80.3", "89.9", "285/289", "289/289", "4.2–4.8×"):
    assert claim in prompts and claim in draft
assert "13.9%" in draft and "13.9%" in redteam
assert "G2 since gate per eligible FRD" in memo
print("Interruption ledger: 64 rows, 91 hits and mapped shares match; benchmark figures: PASS")

def lines(path):
    return len(path.read_text().splitlines())

def total(paths):
    return sum(map(lines, paths))

mjs = tuple(runtime.rglob("*.mjs"))
assert len(mjs) == 166 and total(mjs) == 19371
schema = tuple((runtime / "schemas").rglob("*.json"))
assert len(schema) == 14 and total(schema) == 3435
cli = lines(factory / "plugin/scripts/pandacorp-build.mjs")
skill = total((factory / "plugin/skills/implement").rglob("*.md"))
assert cli == 421 and skill == 824
assert total(mjs) + total(schema) + cli + skill == 24051
groups = ("next", "planner", "drive", "integrate", "failure")
bypass = sum(total((runtime / name).rglob("*.mjs")) for name in groups)
assert bypass + lines(runtime / "rescue.mjs") == 6302
for path, count in (
    ("plugin/runtime/build-state.mjs", 580),
    ("plugin/templates/shared/.pandacorp/merge-queue.sh", 1021),
    ("plugin/templates/shared/.pandacorp/green-stamp.sh", 307),
    ("plugin/templates/shared/.pandacorp/hooks/pre-push", 265),
    ("plugin/templates/stack-a-nextjs/verify.sh", 1464),
):
    assert lines(factory / path) == count
print("Implementation and proof source-size inventories: PASS")

def slug(heading):
    return re.sub(r"[^\w -]", "", heading.lower()).replace(" ", "-")

targets = re.findall(r"\[[^\]\n]+\]\((<[^>\n]+>|[^\s)]+)\)", draft)
for raw_target in targets:
    target = raw_target.strip("<>")
    local, _, anchor = target.partition("#")
    local, _, line = local.partition(":")
    path = (audit / local) if local else proposal
    assert path.is_file(), target
    if line:
        assert 1 <= int(line) <= lines(path), target
    if anchor:
        headings = re.findall(r"^#{1,6} (.+)$", path.read_text(), re.M)
        assert anchor in list(map(slug, headings)), target
assert len(targets) >= 50
print(f"Source references: {len(targets)} local Markdown links and anchors resolve")
