import collections,contextlib,datetime as dt,io,math,re,statistics,sys
from pathlib import Path
from timing_build import build_run
from timing import read_rows,ts
root=Path('/Users/Shared/Proyectos/funko-tracker')
cl=Path.home()/'.claude/projects'
roots=[root/'.pandacorp/run',*(root/'.claude/worktrees').glob('*/.pandacorp/run')]
paths=sorted({p for r in roots for z in ['build','build-archive','build-suspended'] for p in [r/z/'journal.jsonl',*(r/z).glob('*/journal.jsonl')] if p.is_file()})
sizes={'br-2026-11-13-01':'small','br-2026-11-13-02':'small','br-2026-11-14-01':'small','br-2026-11-16-01':'medium','br-2026-11-18-01':'small','br-2026-11-18-02':'small','br-2026-11-21-01':'small','br-2026-11-21-02':'small'}
def durations(n,b,e):
 return (dt.datetime.fromisoformat(e.replace('Z','+00:00'))-dt.datetime.fromisoformat(b.replace('Z','+00:00'))).total_seconds()
def stats(l):
 s=sorted(l)
 return len(s),round(statistics.median(s)/60,2),round(s[math.ceil(.9*len(s))-1]/60,2)
def unions(es):
 groups=collections.Counter()
 for a,b in zip(sorted(es),sorted(es)[1:]):
  active=frozenset(k for ea,eb,k in es[a] if ea<=a and b<=eb)
  groups[active]+=b-a
 return groups
groups=collections.defaultdict(list)
all_i=collections.Counter(); by_class=collections.Counter(); wall=0
for p in paths:
 rows=read_rows(p); r=rows[0][1]['run_id']
 assert [d['seq'] for _,d in rows]==list(range(1,len(rows)+1))
 assert r in sizes
 a,b=(ts(rows[k][1]['at']) for k in (0,-1)); wall+=b-a
 assert all(ts(d['at'])>=a for _,d in rows)
 groups[sizes[r]].append(b-a)
 c=collections.Counter(x['type'] for _,x in rows); u={}
 for _,x in rows:
  if x['type']=='unit_queued':u[x['data']['id']]=x['data']
 dist=collections.Counter(x['data']['cell']['runtime'] for _,x in rows if x['type']=='unit_dispatched')
 wos=sorted({w for x in u.values() for w in x.get('wos',[])})
 patches=sum(1 for _,x in rows if x['type']=='unit_dispatched' and u[x['data']['unit']]['kind']=='patch')
 with contextlib.redirect_stdout(io.StringIO()): jobs=build_run('funko',p,rows)
 clipped=[(max(a,st),min(b,en),'gate' if cat.startswith('G') else cat) for _,_,cat,st,en,src in jobs if min(b,en)>max(a,st)]
 for st,en,k in clipped:by_class[k]+=en-st
 timelines=collections.Counter()
 points=sorted({a,b,*[t for s,e,k in clipped for t in (s,e)]})
 for st,en in zip(points,points[1:]):
  active=frozenset(k for s,e,k in clipped if s<=st and en<=e)
  timelines[active]+=en-st
 all_i.update(timelines)
 print(r,len(rows),round((b-a)/60,3),dist,wos,'patch/redispatch/scope/rescue',patches,sum(v-1 for v in collections.Counter(x['data']['unit'] for _,x in rows if x['type']=='unit_dispatched' and not x['data'].get('resume')).values()),c['scope_repair_approved'],c['rescue_started'],'stop/resume',c['run_stopped'],c['run_resumed'],'unassigned_min',round(timelines[frozenset()]/60,2))
print('subtotal',sum(len(v) for v in groups.values()),'journal rows',sum(len(read_rows(p)) for p in paths))
print('journal size stats',dict((k,stats(v)) for k,v in groups.items()))
print('phase minute sum',dict((k,round(v/60,2)) for k,v in by_class.items()), 'wall',round(wall/60,2))
print('bucket hours',dict((','.join(sorted(k)) or 'outside observed intervals',round(v/3600,4)) for k,v in all_i.items()))
print('single',round(sum(v for k,v in all_i.items() if len(k)==1)/3600,4),'joint',round(sum(v for k,v in all_i.items() if len(k)>1)/3600,4))
legacy={
 'small':[('16:47:52.772','16:57:16.450')],
 'large':[('03:36:05.547','04:05:10.659'),('04:58:25.772','05:48:02.667'),('14:27:57.928','15:38:09.317'),('15:38:30.296','17:44:22.386'),('2026-10-18T18:44:34.793','2026-10-19T05:36:04.250'),('09:10:32.823','09:11:12.544'),('13:03:27.872','14:41:19'),('14:42:26.041','15:33:07'),('15:33:16.578','16:05:48.720'),('16:09:28.871','18:48:04.448')]}
for size,vals in legacy.items():
 for a,b in vals:
  groups[size].append(durations(size,*('2026-10-18T'+x if 'T' not in x else x for x in (a,b))))
print('combined size stats',dict((k,stats(v)) for k,v in groups.items()))
for n,a,b in [
('line code','2026-11-21T15:53:49','2026-11-21T16:13:55.237'),
('line first green','2026-11-21T15:53:49','2026-11-21T16:27:23.828'),
('line push','2026-11-21T15:53:49','2026-11-21T17:05:20.660'),
('sweep verified','2026-11-19T00:38:28','2026-11-19T01:53:02'),
('sweep landed','2026-11-19T00:38:28','2026-11-19T02:49:13'),
('MC local main','2026-10-30T18:46:15','2026-10-31T15:12:14'),
('FRD-12 main','2026-11-16T19:14:48','2026-11-17T21:22:24'),
('FRD-12 close','2026-11-16T19:14:48','2026-11-18T05:53:35'),
('Funko MVP status','2026-10-19T05:36:31','2026-10-19T13:24:23'),
('Explore','2026-11-14T06:36:46.685','2026-11-14T10:35:09'),
('hide ready at cutoff','2026-11-18T23:26:49.932','2026-11-19T00:08:39')]:
 print('direct',n,round(durations(n,a,b)/60,3))
