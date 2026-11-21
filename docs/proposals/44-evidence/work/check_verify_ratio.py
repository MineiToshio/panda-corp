"""Read-only acceptance check for findings/verify-ratio.md. No test/build/gate is invoked."""
from collections import Counter, defaultdict
from pathlib import Path
import json
import random
import re
import subprocess

work = Path(__file__).resolve().parent
report = (work.parent / 'findings/verify-ratio.md').read_text()
projects = Path('/Users/Shared/Proyectos')
factory = projects / 'panda-corp'
funko = projects / 'funko-tracker'
personal = projects / 'personal-page-v2'

def read_json(path):
    return json.loads(path.read_text())

def git(project, *args):
    return subprocess.check_output(['git', '-C', str(project), *args], text=True)

def require(ok, reason):
    if not ok:
        raise ValueError(reason)

def rows(prefix):
    return [line for line in report.splitlines() if re.match(r'^\| '+prefix, line)]

stop = rows(r'S\d+ \|')
workers = rows(r'W\d+ \|')
old = rows(r'E\d+\.A\d+ \|')
reviewers = rows(r'R\d+ \|')
require([len(x) for x in [stop, old, workers, reviewers]] == [25,26,33,10], 'sample coverage')
require(not re.search(r'^\|[-:|]+\|\n\n\|',report,re.M), 'broken Markdown table')
paths = defaultdict(set)
for p, n in re.findall(r'\]\((/[^\n)]+):(\d+)\)', report):
    paths[Path(p)].add(int(n))
source = {}
for p, nums in paths.items():
    remaining = set(nums)
    with p.open() as f:
        for n, line in enumerate(f,1):
            if n in remaining:
                source[p,n]=line
                remaining.remove(n)
            if not remaining:
                break
    require(not remaining, f'missing source line in {p}')
print(f'Report: {len(stop)} Stop, {len(old)} historical queue, {len(workers)} worker, {len(reviewers)} reviewer rows; {len(source)} distinct source locations resolve.')

codes = [re.search(r'\| (\w+) → (\w+) \|', s).groups() for s in stop]
require(sum(a==b for a,b in codes)==20 and sum(a in {'f','fm','d'} for a,b in codes)==16,'Stop agreement')
def feedback(s):
    return 'Stop hook feedback' in s and 'verify gate FAILED' in s
for row in stop:
    p,n=re.search(r'\[red\]\(([^)]+):(\d+)\)',row).groups()
    require(feedback(source[Path(p),int(n)]),row[:12])
refs = read_json(work / 'reds.json')
by = defaultdict(set)
for x in refs:
    by[Path.home()/'.claude/projects'/x['dir']/x['file']].add(x['ts'])
uuids = []
for p,times in by.items():
    for s in p.open():
        if feedback(s):
            x=json.loads(s)
            if x.get('type')=='user' and x.get('timestamp') in times:
                uuids.append(x['uuid'])
require((len(uuids),len(set(uuids)))==(664,638),'transcript replay count')
print('Stop: 20/25 exact class matches, 16 originally noisy, 664 raw copies / 638 UUIDs.')

h=read_json(factory/'docs/proposals/43-evidence/w-tr/episodes.json')
attempts={x['attempt_key']:x for ep in h if ep['project']=='funko-tracker' for x in ep['attempts']}
owned={k for k,x in attempts.items() if x['cause'] in ('a','g')}
require(owned=={line.split('|')[1].strip() for line in old},'unreviewed historical ownership rows')
require(len(attempts)==137 and sum(x['rc']==11 for x in attempts.values())==59,'old ledger')
p=Path(next(e['file'] for e in h if any(x['attempt_key']=='E07.A01' for x in e['attempts'])))
require('exit=11' in next(s for i,s in enumerate(p.open(),1) if i==933),'wrapped exit correction')
require(sum('| Product —' in s for s in old)==4,'behavior cases')
red_counts=[]
for project in (factory/'mission-control',funko,personal):
    lg=project/'.pandacorp/run/queue-log.jsonl'
    rec=[json.loads(z) for z in lg.open() if '"gate_end"' in z]
    red=[x for x in rec if x['rc'] and x['ts'][:10]=='2026-11-21']
    require(all(not read_json(Path(x['report']))['green'] for x in red),'incorrect gate result')
    red_counts.append(len(red))
require(red_counts==[6,1,1],'queue snapshot changed')
print('Queue: 59 numeric exit-11 runs + 1 wrapper-confirmed = 60; all 19 own + 7 repair included; November 21 snapshot 6+1+1 red.')

require('el-trabajo-que-bote' in git(personal,'show','43f534c','--','public/llms.txt'),'first public-index occurrence')
require('tests-en-verde-produccion-rota' in git(personal,'show','931b64f','--','public/llms.txt'),'second public-index occurrence')
require('05:26:54Z' in git(personal,'show','2a1ae37:.pandacorp/build-journal.jsonl'),'reviewer first')
require('prePublishSnapshots' in git(personal,'show','2a1ae37:scripts/blog-generator/publishGuard.ts'),'rollback source')
fixes=[(funko,['93ce170a','6352e617','6493f662','9287219b','6bd683e1','5c2af4df','a1a6dfb4','7c6a923a','d9b4d857','2d62f1fd']), (factory,['0b4aab13d','555004c89','528c70e3']), (personal,['2a1ae37','931b64f','43f534c'])]
for repo, shas in fixes:
    for sha in shas:
        require(git(repo,'show','--format=','--name-only',sha).strip(), f'empty repair {sha}')
print('Git: both index occurrences, reviewer timestamp and rollback, and all reviewer repair objects corroborated.')

# Reconstruct the raw random-draw filter, without retaining transcript contents.
frame=read_json(work/'codex_eps2.json')
draw=random.Random(20261121).sample(range(len(frame)),len(frame))[:86]
chosen=set(draw); expected=set()
exclusions={134,21,123,79,204,19,20,95}
ansire=re.compile(r'\x1b\[[0-9;]*m')
runre=re.compile(r'(?:^|\n)\s*(?:Test Files\s+\d+ failed|Tests\s+\d+ failed|FAIL\s+\|?\w*\|?\s*\S+\.(?:test|spec)\.tsx?|\d+ failed\s*\n)')
failre=re.compile(r'(?:FAIL|✗|×)\s+\|?\w*\|?\s*([\w./()\[\]@-]+\.(?:test|spec)\.tsx?)')
pwre=re.compile(r'›\s+([\w./()\[\]@-]+\.spec\.ts):\d+')
def chunks(value):
    if isinstance(value,list):
        for item in value:
            yield from chunks(item)
    elif isinstance(value,dict):
        if 'chunk_id' in value: yield value
        elif 'text' in value: yield from chunks(value['text'])
    elif isinstance(value,str):
        try: v=json.loads(value)
        except ValueError: return
        yield from chunks(v)
paths_by_name={p.name:p for p in (Path.home()/'.codex/sessions').rglob('*.jsonl')}
ids_by_name=defaultdict(list)
for i,entry in enumerate(frame):
    ids_by_name[entry['sess']].append(i)
for name, ids in ids_by_name.items():
    if not chosen.intersection(ids): continue
    found=0
    for s in paths_by_name[name].open():
        if 'function_call_output' not in s and 'custom_tool_call_output' not in s: continue
        raw=s.replace('\\n','\n').replace('\\u203a','›').replace('\\u00d7','×').replace('\\u2717','✗')
        if not re.search(r'Test Files\s+\d+ failed|\b\d+ failed\b',raw):continue
        names={Path(z).name for z in failre.findall(raw)+pwre.findall(raw)}
        if not names:continue
        r=json.loads(s); p=r.get('payload',{})
        if p.get('type') not in ('custom_tool_call_output','function_call_output'):continue
        if found>=len(ids):break
        i=ids[found];found+=1
        require(names==set(frame[i]['fails']),f'worker frame mismatch: W{i}')
        if i in chosen and any(z.get('exit_code')==1 and runre.search(ansire.sub('',str(z.get('output','')))) for z in chunks(p.get('output',''))):
            expected.add(i)
ids={int(x.split('|')[1].strip()[1:]) for x in workers}
require(len(expected)==41 and expected-exclusions==ids,'worker draw membership')
counts=Counter(x.split('|')[2].strip() for x in workers)
require(counts=={'i':13,'ii':10,'iii':9,'iii-open':1},'worker class totals')
print('Codex: seeded first 86/253 → 41 machine-readable candidates → 33 eligible; 13 planned, 10 source-defect, 9 repaired harness/test, 1 environment-open.')
