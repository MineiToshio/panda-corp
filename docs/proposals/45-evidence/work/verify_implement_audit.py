import collections
import datetime as dt
import json
import re
import subprocess
from pathlib import Path

report = Path('audit/failures.md').read_text()
f = Path('/Users/Shared/Proyectos/funko-tracker')
m = Path('/Users/Shared/Proyectos/panda-corp')
p = Path('/Users/Shared/Proyectos/personal-page-v2')

current = re.findall(r'^\| (N\d+) / (J\d+[ab]?) \|', report, re.M)
legacy = re.findall(r'^\| (L\d+) \| Oct', report, re.M)
assert current == [(f'N{i}', key) for i,key in enumerate(('J13a','J13b','J14','J16','J18a','J18b','J21a','J21b'), 1)]
assert legacy == [f'L{i}' for i in range(1,13)]
assert '0/19 observed delivery attempts' in report
assert '0/20' in report and 'three days outside the fixed window' in report

def rows(path):
    return [json.loads(line) for line in path.open()]

journal_subpaths = (
    '.pandacorp/run/build-archive/br-2026-11-13-01/journal.jsonl',
    '.pandacorp/run/build-suspended/br-2026-11-13-02/journal.jsonl',
    '.pandacorp/run/build-suspended/br-2026-11-14-01/journal.jsonl',
    '.pandacorp/run/build-archive/br-2026-11-16-01/journal.jsonl',
    '.claude/worktrees/eloquent-nash-b37282/.pandacorp/run/build/journal.jsonl',
    '.claude/worktrees/pensive-wing-dad871/.pandacorp/run/build/journal.jsonl',
    '.pandacorp/run/build/journal.jsonl',
    '.claude/worktrees/catalog-line-scope/.pandacorp/run/build/journal.jsonl',
)
journals = [rows(f/path) for path in journal_subpaths]
events = collections.Counter(x['type'] for j in journals for x in j)
assert sum(events.values()) == 939
assert events['unit_dispatched'] == 59
assert events['scope_repair_approved'] == 2 and events['rescue_started'] == 4
assert events['run_resumed'] == 18 and events['run_started'] == 8
assert all(j[0]['type'] == 'run_started' and j[-1]['type'] in ('run_finished','run_stopped') for j in journals)
assert all([x['seq'] for x in j]==list(range(1,len(j)+1)) for j in journals)
assert all(not any(x['type']=='unit_dispatched' and x['data']['unit'].startswith('u-build-') for x in j) for j in journals[-2:])

log = rows(f/'.pandacorp/run/queue-log.jsonl')
direct = [x for x in log if x['branch']=='feat/catalog-line-scope' and x['ts'][:10]=='2026-11-21']
gateends = [x for x in direct if x['event']=='gate_end']
assert len(gateends)==3 and [x['duration_s'] for x in gateends]==[806,8,783]
assert [x['exit'] for x in direct if x['event']=='end']==[21,11,21,0]
push, = [x for x in direct if x['event']=='push' and x['result']=='ok']
assert push['sha'].startswith('d94a6e3a')
clock = (dt.datetime.fromisoformat(push['ts'])-dt.datetime.fromisoformat('2026-11-21T15:53:49+00:00')).total_seconds()
assert round(clock)==4292

register=re.findall(r'^\| ([NL][^|]+) \| ([a-j]) \| ([^|]+?) \| (\d+) \|',report,re.M)
classes, signatures = collections.Counter(), collections.Counter()
for _, category, signature, hits in register:
    classes[category]+=int(hits)
    signatures[signature]+=int(hits)
assert len(register)==64 and sum(classes.values())==91
published = {c:int(n) for c,n in re.findall(r'^\| ([a-j]) · [^|]+ \| (\d+) \|',report,re.M)}
assert dict(classes)==published
assert [count for _,count in signatures.most_common(12)]==[13,12,11,9,8,7,6,5,4,3,3,3]

for root, sha in ((f,'8d0cbba1'),(f,'ea6739fd'),(f,'b8ac99c1'),(f,'d94a6e3a'),(m,'39acdb71'),(p,'0b1fa8a')):
    subprocess.run(['git','-C',str(root),'merge-base','--is-ancestor',sha,'main'],check=True)
assert subprocess.run(['git','-C',str(f),'merge-base','--is-ancestor','d4a79fe0','main']).returncode==1

metrics = subprocess.check_output(
    ['python3', 'work/implement_audit_metrics.py'], text=True,
)
assert "'small': (8, 109.44, 363.87)" in metrics
assert "'large': (10, 60.44, 158.59)" in metrics
assert "'outside observed intervals': 54.9534" in metrics
assert all(value in report for value in ('109.44', '363.87', '60.44', '158.59', '54.953'))
sections = ['Run census', 'Interruption register', 'Wall time and activity', 'Switches to direct implementation', 'Benchmark evidence', 'Coverage, exclusions and reproducibility']
assert all(f'## {section}' in report for section in sections)
assert not any(line.rstrip()!=line for line in report.splitlines())
print('PASS | 20 launch rows, 8/8 CLI journals, 939 contiguous events, 59 dispatches, 64 classification rows, 91 hits, 4 catalog queue starts, 6 main-ancestry checks and 1 unlanded branch check, duration and phase reconciliation')
