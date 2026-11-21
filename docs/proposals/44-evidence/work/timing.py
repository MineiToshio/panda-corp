import collections as c
import datetime as dt
import json
import math
import os
from pathlib import Path
import re
import statistics as st
import subprocess

ROOT = Path('/Users/Shared/Proyectos')
PROJECTS = {p.split('/')[-1]: ROOT/p for p in (
    'panda-corp', 'panda-corp/mission-control', 'funko-tracker', 'personal-page-v2')}
END = dt.datetime.fromisoformat('2026-11-21T16:00:00+00:00').timestamp()
BEGIN = END - 30 * 86400
PRUNE = {'.git', 'node_modules', '.next', '.next-fidelity', '.cache', 'vendor',
         'test-results', 'playwright-report', 'coverage', 'dist', '.pnpm-store'}
STATIC = {'structure-guard','api-error-contract','doc-lint','residual-ambiguity',
          'biome','tsc','knip','madge','eslint','format','lint','typecheck','prettier'}
REPAIR = re.compile(r'^(?:test(?:s)?(?:\([^)]*\))?[!:]|fix\((?:tests?|e2e|ci|gates?|verify|playwright|vitest)[^)]*\)[!:])|\b(?:baseline|flak\w*|gates?|playwright|vitest)\b', re.I)

def git(p, *args):
    return subprocess.check_output(['git','-C',str(p),*args], text=True).rstrip('\n')

def ts(value):
    return dt.datetime.fromisoformat(value.replace('Z','+00:00')).timestamp()

def iso(value):
    return dt.datetime.fromtimestamp(value,dt.timezone.utc).isoformat(timespec='milliseconds')

def span(values):
    times = [ts(v) for v in values if v]
    return f'{iso(min(times))} .. {iso(max(times))}' if times else 'none'

def stats(xs):
    xs = sorted(xs)
    return (len(xs), round(st.median(xs),3), round(xs[math.ceil(.9*len(xs))-1],3),
            round(xs[-1],3), round(sum(xs),3)) if xs else (0,None,None,None,0)

def clipped(intervals):
    return sorted((max(a,BEGIN),min(b,END)) for a,b in intervals
                  if max(a,BEGIN)<min(b,END))

def union(intervals):
    total, last = 0, float('-inf')
    for a,b in sorted(intervals):
        total += max(0,b-max(a,last))
        last = max(last,b)
    return total

def read_rows(f):
    rows=[]
    for n,line in enumerate(f.read_text().splitlines(),1):
        if not line.strip():
            continue
        try:
            rows.append((n,json.loads(line)))
        except ValueError as exc:
            print('BAD ROW',f,n,exc)
    return rows

def discover(label, p):
    worktrees = [Path(l[9:]) for l in git(p,'worktree','list','--porcelain').splitlines()
                 if l.startswith('worktree ')]
    roots = [p]
    for w in worktrees:
        w = w/'mission-control' if label=='mission-control' else w
        if w!=p and w.is_dir():
            roots.append(w)
    print('WORKTREE ROOTS',label,*roots,sep='\n ')
    matches=set()
    pending=set(roots)
    # Runtime includes detached engine worktrees and copied/archive evidence. Discover Claude
    # worktrees separately, including folders no longer registered with Git.
    pending.update(f for r in roots for f in r.glob('.claude/worktrees/*') if f.is_dir())
    checked=set()
    while pending:
        r=pending.pop()
        if r in checked:
            continue
        checked.add(r)
        for name in ('track.jsonl','build-journal.jsonl'):
            f=r/'.pandacorp'/name
            if f.is_file():
                matches.add(f)
        runtime=r/'.pandacorp/run'
        if not runtime.is_dir():
            continue
        for directory,dirs,files in os.walk(runtime):
            dirs[:]=sorted(d for d in dirs if d not in PRUNE)
            for n in files:
                f=Path(directory)/n
                if (n in {'queue-log.jsonl','test-outcomes.jsonl','track.jsonl','build-journal.jsonl',
                          'journal.jsonl','green-stamp','perf-samples.jsonl','perf-rollup.json'}
                    or n.endswith('gate-report.json') or (f.parent.name=='gate-reports' and n.endswith('.json'))
                    or (n.endswith('.log.gz') and 'queue' in n)):
                    matches.add(f)
    if label!='panda-corp':
        scan_root=PROJECTS['panda-corp'] if label=='mission-control' else p
        for relative in git(scan_root,'ls-files','--','*gate-report*.json').splitlines():
            f=scan_root/relative
            if f.is_file():
                matches.add(f)
    return sorted(matches)

def cls(n):
    if n in STATIC:
        return 'static'
    if n in ('vitest','playwright'):
        return n
    return 'other'

def queues(files):
    events={}
    for f in files:
        if f.name != 'queue-log.jsonl':
            continue
        rows=read_rows(f)
        print('QUEUE SOURCE',f,'rows',len(rows),span(r.get('ts') for _,r in rows))
        for n,r in rows:
            if 'event' in r:
                events.setdefault(json.dumps(r, sort_keys=True), (f,n,r))
    groups=c.defaultdict(list)
    for f,n,r in sorted(events.values(),key=lambda x: ts(x[2]['ts'])):
        groups[r['attempt']].append((f,n,r))
    return list(groups.values())

def queue_summary(attempts):
    exits=c.Counter(); kinds=c.Counter(); ready=[]; gate=[]; gate_windows=[]; lock=[]; slot=[]
    span_rows=[]; retries=exact=0; episodes=c.defaultdict(list); landed=[]; turnaround=[]; stages=c.defaultdict(list)
    skips=0
    for rows in attempts:
        span_rows.extend(r['ts'] for _,_,r in rows)
        by={r['event']:(f,n,r) for f,n,r in rows}
        def get(k): return by[k][2] if k in by else {}
        start=get('start'); end=get('end'); ge=get('gate_end'); ff=get('ff')
        if not start:
            if 'ready' in by: ready.append(get('ready'))
            else: print('ORPHAN',rows)
            continue
        branch=start['project'],start['branch']
        ep=episodes[branch]
        retries+=bool(ep)
        exact+=any(r['head']==start['head'] for r in ep)
        ep.append(start)
        exitcode=end.get('exit')
        exits[exitcode]+=1
        outcome = ('landed' if ff.get('result')=='ok' else
                   {0:'exit 0 without ff',10:'rebase conflict',11:'gate/certification rejected',
                    12:'main busy',13:'push failed',14:'verification busy',16:'environment',17:'main advanced',
                    20:'queue usage/lock error',21:'owner release hold',None:'no end'}.get(exitcode, f'exit {exitcode}'))
        kinds[outcome]+=1
        stamp=get('stamp_check').get('result')
        skips+=stamp=='match'
        if ff.get('result')=='ok':
            landed.append(len(ep)-1)
            turnaround.append(ts(ff['ts'])-ts(ep[0]['ts']))
            episodes.pop(branch)
        if 'gate_end' in by:
            gate.append(ge)
            gate_windows.append((ts(ge['ts'])-ge['duration_s'],ts(ge['ts'])))
        for event,target in [('lock_acquired',lock),('slot_acquired',slot)]:
            if event in by:
                e=get(event)
                target.append((ts(e['ts'])-e['waited_s'],ts(e['ts']),e['waited_s']))
        for event in ('env_step','rebase'):
            if 'duration_s' in get(event): stages[event].append(get(event)['duration_s'])
        if end: stages['start-to-exit'].append(ts(end['ts'])-ts(start['ts']))
        print('ATTEMPT',start['attempt'], start['ts'], start['branch'], start['head'][:10],
              'exit',exitcode,'outcome',outcome,'stamp',stamp,'gate',ge.get('rc'),ge.get('duration_s'),
              'lock_s',get('lock_acquired').get('waited_s'),'slot_s',get('slot_acquired').get('waited_s'),
              'land_sha',ff.get('sha'), 'refs',','.join(f'{k}:{v[0]}:{v[1]}' for k,v in by.items() if k in ('start','end','gate_end','ff')))
    count=sum(exits.values())
    fmt=lambda n,d: f'{n}/{d} ({100*n/d:.2f}%)' if d else '0/0 (unavailable)'
    print('QUEUE SUMMARY',span(span_rows),'runs',count,'exits',dict(exits),'outcomes',dict(kinds),
          'exit11',fmt(exits[11],count),'recorded gate rc!=0/16/75',fmt(sum(g['rc'] not in (0,16,75) for g in gate),count),
          'repeat branch',fmt(retries,count),'repeat branch/head',fmt(exact,count),'ready events (without start)',len(ready),
          'stamp matched',skips,'requeues before landing',landed,'mean',round(st.mean(landed),3) if landed else None)
    print('QUEUE OTHER CLOCKS', {k:stats(v) for k,v in stages.items()}, 'first enqueue-to-ff', stats(turnaround))
    print('QUEUE GATES',stats(g['duration_s'] for g in gate),'rc',dict(c.Counter(g['rc'] for g in gate)),
          'summed 30d h',round(sum(b-a for a,b in clipped(gate_windows))/3600,6),
          'union approx 30d h',round(union(clipped(gate_windows))/3600,6))
    for name,data in [('lock',lock),('host slot',slot)]:
        print('QUEUE WAIT',name,stats(s for _,_,s in data),'summed 30d seconds',
              round(sum(b-a for a,b in clipped([(a,b) for a,b,s in data])),3))
    return gate

def reports(files):
    result={}
    for f in files:
        if not (('gate-report' in f.name and f.suffix=='.json') or f.parent.name=='gate-reports'):
            continue
        try: r=json.loads(f.read_text())
        except ValueError as exc:
            print('BAD REPORT',f,exc);continue
        if not isinstance(r.get('subgates'),list) or not r.get('at'):
            print('REPORT without typed durations',f, list(r));continue
        if ts(r['at'])>END:
            print('REPORT after cutoff',f,r['at']);continue
        key=json.dumps({k:r.get(k) for k in ('at','sha','scope','green','subgates')},sort_keys=True)
        if key in result:
            print('REPORT duplicate',f,result[key][0]);continue
        result[key]=(f,r)
    return list(result.values())

def report_summary(rs, gate, detail=True):
    gate_paths={Path(g['report']).name for g in gate if g.get('report')}
    for cohort, subset in [('queue archive',[(f,r) for f,r in rs if f.name in gate_paths and f.parent.name=='gate-reports']),
                           ('other reports',[(f,r) for f,r in rs if f.name not in gate_paths or f.parent.name!='gate-reports'])]:
        print('REPORT COHORT',cohort,len(subset),span(r['at'] for _,r in subset))
        stages=c.defaultdict(list); cats=c.Counter(); reds=c.Counter(); primary=c.Counter(); sums=[]; window=c.Counter()
        for f,r in subset:
            entries=[s for s in r['subgates'] if isinstance(s.get('duration_ms'),(int,float))]
            total=sum(s['duration_ms']/1000 for s in entries); sums.append(total)
            if detail:
                print('REPORT',f,'at',r['at'],'scope',r.get('scope'),'green',r.get('green'),'sha',r.get('sha'),
                      'subgates name:seconds:exit',','.join(f"{s['name']}:{s['duration_ms']/1000}:{s.get('exit')}" for s in entries))
            lead=next((s['name'] for s in entries if s.get('exit') not in (None,0)),None)
            if lead: primary[lead]+=1
            for s in entries:
                name=s['name']; sec=s['duration_ms']/1000
                stages[name].append(sec); cats[cls(name)]+=sec
                if s.get('exit') not in (None,0): reds[name]+=1
                if BEGIN<=ts(r['at'])<=END:window[cls(name)]+=sec
        print('REPORT stage sums per report',stats(sums),'category seconds and percent',
              {k:(round(v,3),round(100*v/sum(cats.values()),2)) for k,v in cats.items()} if sum(cats.values()) else {},
              '30d reported stage seconds',{k:round(v,3) for k,v in window.items()})
        for n,values in sorted(stages.items(),key=lambda pair:-sum(pair[1])):
            print('STAGE',n,stats(values),'red',reds[n])
        print('PRIMARY RED STAGE',dict(primary))
        print('RED STAGES TOP 10',sorted(reds.items(),key=lambda item:(-item[1],item[0]))[:10])

def tests(files, project):
    result={}
    for f in files:
        if f.name != 'test-outcomes.jsonl':
            continue
        rows=read_rows(f)
        print('TEST SOURCE',f,len(rows),span(r.get('ts') for _,r in rows))
        for n,r in rows:
            if r.get('ts') and ts(r['ts'])<=END:
                result.setdefault(json.dumps(r, sort_keys=True),(project,f,n,r))
    return list(result.values())

def test_summary(rows):
    by_tree=c.defaultdict(set); failures=c.Counter(); refs={}; sources=c.Counter()
    for p,f,n,r in rows:
        status=r.get('status'); tree=r.get('tree'); test_id=r.get('test_id')
        # One logical id per project and runner. Keep legacy serialization as logged.
        key=(p,r.get('runner'),test_id)
        if tree and test_id:by_tree[key,tree].add(status)
        if status=='failed':
            failures[key]+=1
            refs.setdefault(key,f'{f}:{n}')
        sources[r.get('runner'),status]+=1
    both=[(key,tree) for (key,tree),statuses in by_tree.items() if {'passed','failed'}<=statuses]
    unique={key for key,_ in both}
    for key,tree in sorted(both):
        matches=[(f,n,r.get('status'),r.get('attempt'),r.get('retry'))
                 for p,f,n,r in rows if key==(p,r.get('runner'),r.get('test_id')) and r.get('tree')==tree]
        print('SAME-TREE',key,tree,[(f'{f}:{n}',status,attempt,retry) for f,n,status,attempt,retry in matches])
    print('TEST SUMMARY',len(rows),span(r['ts'] for _,_,_,r in rows),
          'runner/status',dict(sources),'attempts',len({(p,r.get('attempt')) for p,_,_,r in rows}),
          'failures',sum(failures.values()),'distinct failed',len(failures),'same-tree distinct IDs',len(unique),
          'ID/tree pairs',len(both),'suspects by runner',dict(c.Counter(k[1] for k in unique)))
    for key,n in sorted(failures.items(),key=lambda x:(-x[1],str(x[0])))[:10]:
        print('TEST FAIL',n,key,'same-tree suspect',key in unique,refs[key])

def landings(project, path):
    rows=[l.split('\t',2) for l in git(path,'reflog','show','--date=iso-strict',
                    '--format=%H%x09%gd%x09%gs','main').splitlines()]
    result=[]
    seen=0
    print('REFLOG',project,'entries',len(rows),rows[-1][1] if rows else '-',rows[0][1] if rows else '-')
    for (new, selector, action),(old,_,_) in zip(rows,rows[1:]):
        if not (action.startswith('merge ') and action.endswith('Fast-forward')):
            continue
        landed=ts(selector.split('{',1)[1][:-1])
        if not BEGIN<=landed<=END:
            continue
        commits=[]
        for line in git(path,'log','--reverse','--format=%H%x09%at%x09%ct%x09%s',f'{old}..{new}').splitlines():
            sha,author,commit,subj=line.split('\t',3)
            if project in ('panda-corp','mission-control'):
                changed=git(path,'diff-tree','--root','-m','--no-commit-id','--name-only','-r',sha).splitlines()
                if not any(x.startswith('mission-control/')==(project=='mission-control') for x in changed):
                    continue
            commits.append((sha,int(author),int(commit),subj))
        if not commits:
            continue
        nrep=sum(bool(REPAIR.search(m[3])) for m in commits[1:])
        first=commits[0]
        elapsed=landed-first[1]
        result.append((elapsed,nrep,len(commits)-1,old,new))
        print('LAND',project,iso(landed),old[:12],new[:12],action,'first',first[0][:12],iso(first[1]),
              'first_committer',iso(first[2]),'elapsed author seconds',elapsed,
              'elapsed first committer seconds',landed-first[2],'commits',len(commits),'repair matches after first',nrep)
        for sha,a,b,s in commits:
            print(' COMMIT',sha,iso(a),iso(b),'heuristic',bool(REPAIR.search(s)),s)
        if len(result)>=6:break
    print('LAND SUMMARY',project,stats(x[0] for x in result),'repair matches',sum(x[1] for x in result),
          'commits after first',sum(x[2] for x in result))
    return result

if __name__=='__main__':
    import sys
    mode=sys.argv[1]
    all_q=[];all_r=[];all_t=[];all_l=[]
    print('Analysis window UTC',iso(BEGIN),iso(END),'stats=(n,median,nearest-rank-p90,max,sum), seconds')
    for name,p in PROJECTS.items():
        print('\nPROJECT',name,p)
        if mode=='git':
            all_l.extend(landings(name,p)); continue
        files=discover(name,p)
        if mode=='build':
            from timing_build import builds
            all_l.extend(builds(name,p,files)); continue
        qs=queues(files)
        qs=[[(f,n,r) for f,n,r in rr if ts(r['ts'])<=END] for rr in qs]
        qs=[rr for rr in qs if rr]
        rs=reports(files)
        t=tests(files,name)
        print('INVENTORY discoveries',dict(c.Counter(f.name if f.parent.name!='gate-reports' else 'gate-reports/*.json' for f in files)))
        qg=queue_summary(qs)
        report_summary(rs,qg)
        test_summary(t)
        all_q.extend(qs);all_r.extend(rs);all_t.extend(t)
    print('\nOVERALL')
    if mode=='queue':
        import contextlib,io
        # Keep project-specific raw rows above and print just aggregate rows below.
        buf=io.StringIO()
        with contextlib.redirect_stdout(buf): totals=queue_summary(sorted(all_q,key=lambda rr:rr[0][2]['ts']))
        print('\n'.join(l for l in buf.getvalue().splitlines() if not l.startswith('ATTEMPT')))
        report_summary(all_r,totals,False);test_summary(all_t)
    elif mode=='git':
        print('LAND SUMMARY pooled project slices (shared merges can appear twice)',stats(x[0] for x in all_l),
              'repair matches',sum(x[1] for x in all_l),'commits after first',sum(x[2] for x in all_l))
        unique={}
        for elapsed, repairs, count, old, new in all_l:
            if (old,new) in unique:
                a,b,cnt=unique[old,new]
                elapsed,repairs,count=max(a,elapsed),b+repairs,cnt+count
            unique[old,new]=elapsed,repairs,count
        print('LAND SUMMARY unique sampled ref moves (longer first-author slice clock on shared moves)',
              stats(x[0] for x in unique.values()))

    else:
        from timing_build import aggregate
        aggregate(all_l)
