import json
from pathlib import Path
import re
from timing import PROJECTS, git, stats, ts

work=Path(__file__).parent
queue=(work/'timing-queue.txt').read_text()
build=(work/'timing-build.txt').read_text()
archive=(work/'timing-archive.txt').read_text()
native=(work/'timing-native.txt').read_text()
gitout=(work/'timing-git.txt').read_text()

expected={'mission-control':(11,9,6,3186), 'funko-tracker':(7,4,1,4349),
          'personal-page-v2':(8,4,1,418)}
whole=[0]*4
stage_totals={}
for p,expected_row in expected.items():
    run=PROJECTS[p]/'.pandacorp/run'
    rows=[json.loads(l) for l in (run/'queue-log.jsonl').read_text().splitlines()]
    starts=[r for r in rows if r['event']=='start']
    ends={r['attempt']:r for r in rows if r['event']=='end'}
    gates=[r for r in rows if r['event']=='gate_end']
    assert {r['attempt'] for r in starts}==set(ends)
    actual=(len(starts),len(gates),sum(ends[r['attempt']]['exit']==11 for r in gates),sum(r['duration_s'] for r in gates))
    assert actual==expected_row
    assert str(stats(g['duration_s'] for g in gates)) in queue
    assert len({g['report'] for g in gates})==len(gates)
    for g in gates:
        f=run/'gate-reports'/Path(g['report']).name
        r=json.loads(f.read_text())
        assert r['green']==(g['rc']==0)
        for s in r['subgates']:
            stage_totals[s['name']]=stage_totals.get(s['name'],0)+s['duration_ms']
    whole=[a+b for a,b in zip(whole,actual)]
assert whole==[26,17,8,7953]
assert sum(stage_totals.values())==7908365
assert [stage_totals[k] for k in ('playwright','vitest')]==[4939318,2527461]
assert native.count('"full_gates":')==3 and '2750.088' in native and '7281.411' in native and '7183.557' in native
print('PASS 26 starts/ends, 17 matching reports, 8 red gate exits, 7,953 queue-gate seconds and 7,908.365 report-stage seconds')

same=PROJECTS['personal-page-v2']/'.pandacorp/run/test-outcomes.jsonl'
rows=same.read_text().splitlines()
a,b=[json.loads(rows[i-1]) for i in (1571,3182)]
assert (a['test_id'],a['tree'])==(b['test_id'],b['tree'])
assert {a['status'],b['status']}=={'passed','failed'} and a['attempt']!=b['attempt']
assert 'TEST SUMMARY 47312' in queue and 'same-tree distinct IDs 1' in queue
print('PASS same-tree opposite outcomes independently checked against the two line references')

suspended=PROJECTS['funko-tracker']/'.pandacorp/run/build-suspended/br-2026-11-13-02'
g2=[json.loads(l)['data'] for l in (suspended/'journal.jsonl').read_text().splitlines()
    if json.loads(l)['type']=='gate' and json.loads(l)['data']['tier']=='G2']
assert len(g2)==39 and len({(r['sha'],r['exit']) for r in g2})==1 and g2[0]['exit']==0
jobs=list((suspended/'jobs').glob('g2-*/cmd.json'))
assert len(jobs)==40
inputs={(r['cwd'], r['cmd'][-1]) for r in map(lambda f: json.loads(f.read_text()),jobs)}
assert len(inputs)==1 and all(f.with_name('exit').read_text().strip()=='0' for f in jobs)
assert len(re.findall(r'^JOURNAL SOURCE ',build,re.M))==8
assert 'worktree' in queue.lower() and '45, 150.207, 167.418' in build
print('PASS 8 build journals, 39 harvested green G2 events and 40 successful saved job exits on their common command inputs')

land_rows=re.findall(r'^LAND (?!SUMMARY)(\S+) (\S+) (\w+) (\w+) .*? first (\w+) (\S+)',gitout,re.M)
assert len(land_rows)==21 and len({(old,new) for _,_,old,new,_,_ in land_rows})==16
for project, landed, old, new, first, author in land_rows:
    assert git(PROJECTS[project],'show','-s','--format=%at',first)==str(int(ts(author)))
    refs=git(PROJECTS[project],'reflog','show','--format=%h%x09%gd','--abbrev=12','--date=iso-strict','main')
    assert any(sha==new and ts(selector.split('{',1)[1][:-1])==ts(landed)
               for sha,selector in (line.split('\t',1) for line in refs.splitlines()))
assert 'unique sampled ref moves' in gitout and '(16, 2433.5' in gitout
assert '523.34' in archive and '1034 passed (21.6m)' in archive
print('PASS 21 Git project slices / 16 unique ref moves and two archived Mission Control timing sources')

report=work.parent/'findings/timing.md'
s=report.read_text()
for section in ('Queue attempts and waits','Gate duration and stage cost','Red stages and same-tree outcomes',
                'Build CLI and work orders','Time to main','Commands and raw output'):
    assert section in s, section
for n in ('26','7,953','2.209','62.46','40','45','47,312','39','523.34'):
    assert n in s, n
for source in ('timing-queue.txt','timing-build.txt','timing-git.txt','timing-archive.txt','timing-native.txt'):
    assert (work/source).stat().st_size>100 and source in s
print('PASS report sections, key numbers and raw evidence attachments present')
