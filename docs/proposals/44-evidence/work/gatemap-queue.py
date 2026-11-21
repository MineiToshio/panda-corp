import collections, json, pathlib, re, statistics, subprocess
root=pathlib.Path('/Users/Shared/Proyectos')
for p in (root/'panda-corp/mission-control',root/'funko-tracker',root/'personal-page-v2'):
    print(p.name)
    run=p/'.pandacorp/run'
    log=[json.loads(l) for l in (run/'queue-log.jsonl').read_text().splitlines() if l]
    def summarize(event,key):
        values=[x[key] for x in log if x['event']==event and isinstance(x.get(key),(int,float))]
        print(event,key,(len(values),statistics.median(values),min(values),max(values)) if values else '-')
    for event,key in [('lock_acquired','waited_s'),('slot_acquired','waited_s'),('env_step','duration_s'),('rebase','duration_s'),('gate_end','duration_s'),('end','duration_s')]:summarize(event,key)
    print('gate rc',collections.Counter(x.get('rc') for x in log if x['event']=='gate_end'),'stamp',collections.Counter(x.get('result') for x in log if x['event']=='stamp_check'))
    print('full gate outcomes')
    for i,x in enumerate(log,1):
        if x['event']!='gate_end':continue
        reb=next((r for r in log if r['attempt']==x['attempt'] and r['event']=='rebase'),{})
        base,head=reb.get('base'),reb.get('head')
        if not base or not head:continue
        q=subprocess.run(['git','-C',str(p),'diff','--name-only',base,head],capture_output=True,text=True)
        files=q.stdout.splitlines()
        print(i,x['rc'],x['duration_s'],x['branch'],(len(files),files[:3]) if not q.returncode else 'commits unavailable')
    for name in ('gate-budget.json','test-exclusions.json','exclusion-owner.pub'):
        print(name,(p/'.pandacorp'/name).is_file())
    e2e=p/'e2e'
    print('physical e2e snapshots',sum(f.is_file() and f.suffix.lower() in {'.png','.jpg','.jpeg','.webp'} and any(s.endswith('-snapshots') for s in f.parts) for f in e2e.rglob('*')))
    ys=[(i,x) for i,x in enumerate(log,1) if x['event']=='gate_end' and x['rc']==0]
    print('green full attempts',[(i,x['duration_s']) for i,x in ys])

from datetime import datetime
run=root/'funko-tracker/.pandacorp/run'
for file in sorted(run.glob('build*/*/journal.jsonl')):
    rows=[json.loads(line) for line in file.open() if line.strip()]
    starts={}
    durations=collections.defaultdict(list)
    pins=collections.Counter()
    for row in rows:
        event,d=row['type'],row['data']
        if event=='job_started': starts[d['id']]=row
        if event=='gate' and d.get('tier')=='G2':
            pins[(d.get('sha'),d.get('exit'),d.get('stale'))]+=1
        if event=='job_finished' and d['id'] in starts:
            start=starts[d['id']]
            if start['data']['kind'] not in {'g2','land'}: continue
            key=(start['data']['kind'],d.get('state'),d.get('exit'))
            durations[key].append((datetime.fromisoformat(row['at'])-datetime.fromisoformat(start['at'])).total_seconds())
    print('FT journal',file.relative_to(run),'completed jobs n/median/min/max', {key:(len(ls),round(statistics.median(ls),3),round(min(ls),3),round(max(ls),3)) for key,ls in durations.items()}, 'G2 pins',dict(pins))
