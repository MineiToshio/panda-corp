import json,sys,re
S=sys.argv[1]
eps=json.load(open(S+"/w-tr/episodes.json"))
ft=[e for e in eps if e['project']=='funko-tracker']
def nr(v,p):
    v=sorted(v); return round(v[min(len(v)-1,int(round(p*(len(v)-1))))],1)
def interp(v,p):
    v=sorted(v); k=p*(len(v)-1); f=int(k); c=min(f+1,len(v)-1); return round(v[f]+(v[c]-v[f])*(k-f),1)
for name,cond in (('post13',lambda e:e['queue_start']>='2026-11-13'),('pre13',lambda e:e['queue_start']<'2026-11-13')):
    L=[e for e in ft if cond(e) and e['landed']]
    a=[e['wall_s']/60 for e in L if e['wall_s']]; b=[e['wall_queue_s']/60 for e in L if e['wall_queue_s']]
    print(name,'landed',len(L),'| from ready-or-first-run (wall_s): n',len(a),'med',nr(a,.5),'p90',nr(a,.9),'| from first queue run (wall_queue_s): n',len(b),'med',nr(b,.5),'p90 nearest',nr(b,.9),'interp',interp(b,.9))
    nready=sum(1 for e in L if e['wall_s'] and e['wall_queue_s'] and abs(e['wall_s']-e['wall_queue_s'])>1)
    print('   episodes whose start is an observed ready before the queue:',nready)
    g=[a2['duration_s']/60 for e in ft if cond(e) for a2 in e['attempts'] if a2['outcome'] and a2['outcome'].startswith('aterriz') and not a2['certified'] and a2['duration_s']]
    g2=[x for x in g if x>2]
    print('   green landing runs without stamp marker: n',len(g),'med',nr(g,.5),'p90',nr(g,.9),'| same with duration>2min: n',len(g2),'med',nr(g2,.5))
    r=[a2['duration_s']/60 for e in ft if cond(e) for a2 in e['attempts'] if a2['rc']==11 and a2['duration_s']]
    print('   rc=11 runs n',len(r),'med',nr(r,.5),'p90',nr(r,.9))
# short landings after exit 21
for e in ft:
    at=e['attempts']
    for i in range(1,len(at)):
        if at[i-1]['rc']==21 and at[i]['outcome'] and at[i]['outcome'].startswith('aterriz'):
            print('after-21 landing',e['id'],i+1,round(at[i]['duration_s'],1),'s certified-marker',at[i]['certified'])
# load timeouts, db reds
for e in ft:
    for a2 in e['attempts']:
        d=(a2.get('diagnosis') or '').lower()
        if a2['outcome'] and 'rojo' in a2['outcome'] and ('timeout' in d or 'carga' in d or 'tiempo' in d):
            print('timeout-ish',e['id'],e['queue_start'][:10],a2['cause'],d[:70])
        if a2['outcome'] and 'rojo' in a2['outcome'] and ('ft_gate' in d or 'base' in d or 'bd' in d or 'db' in d or 'fixture' in d):
            print('db-ish',e['id'],e['queue_start'][:10],a2['cause'],d[:70])
