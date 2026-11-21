import json,random,sys
D='/private/tmp/claude-501/-Users-sergio--claude-spares-spare-TJqzMF/d175f413-182a-404b-bc80-1f5840e42eb6/scratchpad/w-tr/episodes.json'
d=json.load(open(D)); by={}
for e in d:
  for a in e['attempts']:
    if (a.get('cause') or 'z') in 'afgh': by.setdefault(a['cause'],[]).append((e,a))
random.seed(7); S=[]
for c,n in [('f',6),('a',5),('g',3),('h',2)]:
  S+= [(c,x) for x in random.sample(by[c],n)]
for c,(e,a) in S:
  print('=====',e['id'],a['attempt_key'],c,a['rc'],a['diagnosis']); print(' file',e['file']); print(' endline',a['end']['line'] if a.get('end') else None)
  for q in a.get('quote') or []: print('  Q',q[0][:200],'@',q[1]['line'])
