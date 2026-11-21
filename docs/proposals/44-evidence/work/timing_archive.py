import collections as c
import gzip
import json
from pathlib import Path
import re
from timing import PROJECTS, git, iso, stats

factory=PROJECTS['panda-corp']
archive=PROJECTS['mission-control']/'.pandacorp/run/archive/queue-next-16-4-3.log.gz'
evidence=factory/'docs/proposals/43-evidence'
patterns=[
    re.compile(r'^\s*Duration\s+\d+\.\d+s'),
    re.compile(r'^\s+\d+ passed \([\d.]+[ms]\)\s*$'),
    re.compile(r'^merge-queue:.*(?:merged |RED|full integration gate)'),
    re.compile(r'^real\s+'),
]

def markers(file):
    op=gzip.open if file.suffix=='.gz' else open
    with op(file,'rt',errors='replace') as reader:
        for n,line in enumerate(reader,1):
            if any(test.search(line) for test in patterns):
                yield n,line.strip()

for f in (archive,evidence/'out/verify-mission-control.log'):
    print('STDOUT',f,'file mtime UTC',iso(f.stat().st_mtime))
    for n,l in markers(f): print(n,l)
for l in git(factory,'reflog','show','--date=iso-strict','--format=%H %gd %gs','main').splitlines():
    if 'fin/next-land:' in l: print('HISTORICAL REFLOG',l)
start=int((evidence/'out/mc-start.epoch').read_text())
end=int((evidence/'out/mc-end.epoch').read_text())
print('HISTORICAL MC BENCHMARK (epoch sidecars)',iso(start),iso(end),end-start)

# Prior transcript annotations were captured by a different worker/window. Read its
# published episode rows and prior outcome aggregates as separate corroboration.
episodes=evidence/'w-tr/episodes.md'
rows=c.defaultdict(list)
for n,l in enumerate(episodes.read_text().splitlines(),1):
    if not re.match(r'^\| \[EP\d+\]\(#ep\d+\)',l):continue
    columns=[v.strip() for v in l.strip('|').split('|')]
    name=columns[1].rsplit(' / S',1)[0]
    rows[name].append((n,columns[2],int(columns[5]),columns[6]=='aterrizó',float(columns[7].rstrip(' min').lstrip('≥'))))
for name,eps in rows.items():
    landed=[e for e in eps if e[3]]
    print('HISTORICAL TRANSCRIPT EPISODES',name,f'{episodes}:{eps[0][0]}-{eps[-1][0]}',
          'dates',min(x[1] for x in eps),max(x[1] for x in eps),
          'episodes',len(eps),'calls',sum(x[2] for x in eps),'landed',len(landed),
          'requeues (post-first calls)',sum(x[2]-1 for x in eps),'requeues on landed',sum(x[2]-1 for x in landed),
          'landed minute stats (rounded input)',stats(x[4] for x in landed))
print('HISTORICAL TRANSCRIPT prior aggregate JSON (source-reported)', (evidence/'w-tr/aggregates.json').read_text())

for p in PROJECTS.values():
    # 'runs' directory names at the runtime root or old v2 convention.
    for d in (p/'.pandacorp/run/runs',p/'.pandacorp/runs',p/'.pandacorp/run/build/runs'):
        print('RUNS ROOT',d,d.is_dir())
