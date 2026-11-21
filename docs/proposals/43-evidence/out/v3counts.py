"""Reproducible counts for memo 43 v3. Usage: python3 v3counts.py <scratchpad>"""
import json,sys,statistics as st
from datetime import datetime
S=sys.argv[1]
eps=json.load(open(S+"/w-tr/episodes.json"))
ft=[e for e in eps if e['project']=='funko-tracker']
ts=lambda s: datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def nr(v,p): v=sorted(v); return round(v[min(len(v)-1,int(round(p*(len(v)-1))))],1)
MECH=('pageprops','biome')
for name,cond in (('since 13 Nov',lambda e:e['queue_start']>='2026-11-13'),('before 13 Nov',lambda e:e['queue_start']<'2026-11-13')):
    L=[e for e in ft if cond(e) and e['landed']]
    a=[e['wall_s']/60 for e in L]; b=[e['wall_queue_s']/60 for e in L]
    print(f"{name}: landed episodes n={len(L)}")
    print(f"  from declared ready (or first queue run if none observed; {sum(1 for e in L if abs(e['wall_s']-e['wall_queue_s'])>1)} with ready observed): median {st.median(a):.1f} min, p90 {nr(a,.9)} (nearest rank)")
    print(f"  from first queue run: median {st.median(b):.1f} min, p90 {nr(b,.9)} (nearest rank)")
    g=[x['duration_s']/60 for e in ft if cond(e) for x in e['attempts'] if x['outcome'] and x['outcome'].startswith('aterriz') and not x['certified'] and x['duration_s']]
    print(f"  green landing queue runs without [certified-tree] marker: n={len(g)}, median {st.median(g):.1f} min, p90 {nr(g,.9)}")
    # mechanical what-if: remove red rounds whose recorded diagnosis is missing PageProps types or missing biome
    new=[]; removed=0
    for e in L:
        w=e['wall_queue_s']; at=e['attempts']
        for i,x in enumerate(at):
            d=(x.get('diagnosis') or '').lower()
            if x['rc']==11 and any(k in d for k in MECH) and i+1<len(at):
                w-= ts(at[i+1]['initial']['ts'])-ts(x['initial']['ts']); removed+=1
        new.append(w/60)
    print(f"  what-if without the {removed} PageProps/biome red rounds: median {st.median(new):.1f}, p90 {nr(new,.9)}")
tot=0
for e in ft:
    at=e['attempts']
    for i,x in enumerate(at):
        d=(x.get('diagnosis') or '').lower()
        if x['rc']==11 and any(k in d for k in MECH) and i+1<len(at):
            m=(ts(at[i+1]['initial']['ts'])-ts(x['initial']['ts']))/60; tot+=m; print(f"  removed round {e['id']} attempt {i+1}: {m:.1f} min")
print(f"total wall removed by the mechanical fix: {tot:.1f} min over {len(ft)} funko episodes")
