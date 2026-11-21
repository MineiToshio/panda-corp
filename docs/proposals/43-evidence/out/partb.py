import json,statistics as st,collections as C,datetime as dt
d=json.load(open('/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad/w-tr/episodes.json'))
T=lambda s:dt.datetime.fromisoformat(s.replace('Z','+00:00')).timestamp()
def q(xs,p):
  xs=sorted(x for x in xs if x is not None)
  if not xs: return None
  return round(xs[min(len(xs)-1,int(round(p*(len(xs)-1))))]/60,1)
def cls(a):
  o=a.get('outcome') or ''; rc=a.get('rc')
  if o.startswith('aterriz'): return 'aterrizó'
  if rc==21 or 'aprobación' in o: return 'código 21'
  if 'conflicto' in o: return 'conflicto rebase'
  if 'main ocupado' in o or rc==12: return 'código 12/main ocupado'
  if rc==11 or 'rojo del gate' in o or o=='rojo / bloqueo' and a.get('cause')=='a': return 'rojo gate'
  if 'timeout' in o: return 'timeout'
  return 'desconocido/no ejecutó ('+o[:30]+')'
print('## B1'); 
for p in sorted({e['project'] for e in d}):
  E=[e for e in d if e['project']==p]; A=[a for e in E for a in e['attempts']]
  L=[e for e in E if e['landed']]
  first=sum(1 for e in E if e['attempts'] and cls(e['attempts'][0])=='aterrizó')
  print(p,len(E),len(A),f"{first}/{len(E)}",q([e['wall_s'] for e in L],.5),q([e['wall_s'] for e in L],.9),q([a.get('duration_s') for a in A],.5),q([a.get('duration_s') for a in A],.9),sum(cls(a)=='rojo gate' for a in A))
print('## B3'); c=C.Counter(cls(a) for e in d for a in e['attempts']); print(c)
print('## B2')
for p in sorted({e['project'] for e in d}):
  qs=gap=0; n21=[]; 
  for e in d:
    if e['project']!=p or not e['landed']: continue
    A=e['attempts']; qs+=sum(a.get('duration_s') or 0 for a in A)
    for i,a in enumerate(A):
      if cls(a)=='código 21' and i+1<len(A) and a.get('end'):
        n21.append((e['id'],T(A[i+1]['call']['ts'])-T(a['end']['ts'])))
  W=sum(e['wall_s'] for e in d if e['project']==p and e['landed'])
  print(p,'pared',round(W/3600,2),'h cola',round(qs/3600,2),'h entre',round((W-qs)/3600,2),'h', 'n21',[(i,round(s/60,1)) for i,s in n21])
print('## B4')
def gk(e):
  ms=[g.get('mode','?') for g in e['gates']]+[ (g.get('mode','?') if isinstance(g,dict) else str(g)) for g in e.get('inline_gates') or []]
  for k in ['verify completo','--light','--only','tests sueltos']:
    if any(k in m for m in ms): return k
  return 'ninguno/desconocido:'+','.join(sorted(set(ms)))[:40]
g=C.defaultdict(lambda:[0,0])
for e in d:
  k=gk(e); g[k][0]+=1; g[k][1]+= bool(e['attempts']) and cls(e['attempts'][0])=='aterrizó'
for k,v in g.items(): print(k,v)
g2=C.defaultdict(lambda:[0,0,0])
for e in d:
  k=gk(e); A=e['attempts']; g2[k][0]+=1; g2[k][1]+= cls(A[0])!='rojo gate'; g2[k][2]+=sum(cls(a)=='rojo gate' for a in A)
print('primer intento sin rojo de gate / rojos totales', dict(g2))
print('## B5'); print(C.Counter(min(len(e['attempts']),4) for e in d))
for e in d:
  if len(e['attempts'])>=3: print(e['id'],e['project'][:6],[ (cls(a)[:6],a.get('cause')) for a in e['attempts']])
print('## B6')
for e in d:
  for a in e['attempts']:
    if a.get('certified') or e['project']!='funko-tracker': print(e['id'],e['project'],a['attempt_key'],cls(a),a.get('duration_s'),a.get('certified'),a['call']['text'][:140].replace('\n',' '))
print('## B7')
iv=[(e['session'],T(a['call']['ts']),T(a['end']['ts']) if a.get('end') else None,e['id'],a) for e in d for a in e['attempts']]
reds=[x for x in iv if cls(x[4])=='rojo gate' and x[2]]
ov=0
for s,a0,a1,i,a in reds:
  if any(s2!=s and b1 and b0<a1 and b1>a0 for s2,b0,b1,_,_ in iv): ov+=1
print('reds',len(reds),'overlap con cola de otra sesión',ov)
# corrected red causes
print('## causas de rojos rc11', C.Counter(x[4].get('cause') for x in iv if cls(x[4])=='rojo gate'))
